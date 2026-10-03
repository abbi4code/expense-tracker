import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Group, GroupMember, LocalDB, OutboxItem, RowTable } from "./local";

// Parents before children, so a fresh device never holds an expense whose category is missing.
const ROW_TABLES: RowTable[] = [
  "categories",
  "payment_methods",
  "recurring_rules",
  "budgets",
  "favourites",
  "expenses",
];
const GROUP_ROW_TABLES: RowTable[] = ["group_recurring_rules", "group_expenses", "settlements"];

type Fetched = { table: RowTable; rows: { id: string; updated_at: string }[]; latest: string | undefined };
const PAGE_SIZE = 1000;
// Re-read a little before the last cursor so rows committed slightly out of order aren't missed.
const CURSOR_OVERLAP_MS = 60_000;

const BATCH_SIZE = 200;

/** Consecutive changes to the same table with the same fields go up in one request. */
function takeBatch(items: OutboxItem[], start: number): OutboxItem[] {
  const first = items[start];
  if (first.table === "profiles" || (first.op ?? "upsert") !== "upsert") return [first];
  const shape = fieldsOf(first);
  const batch = [first];
  for (let i = start + 1; i < items.length && batch.length < BATCH_SIZE; i++) {
    // Same field set only: a bulk upsert would fill missing fields with defaults.
    if (items[i].table !== first.table || (items[i].op ?? "upsert") !== "upsert" || fieldsOf(items[i]) !== shape) break;
    batch.push(items[i]);
  }
  return batch;
}

const fieldsOf = (item: OutboxItem) => Object.keys(item.payload).sort().join(",");

/** The server owns updated_at (trigger/default), so other devices' sync cursors stay correct. */
function serverPayload(item: OutboxItem) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updated_at, ...payload } = item.payload;
  return payload;
}

function isTransient(status: number) {
  return !navigator.onLine || status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

type SendResult = { ok: true; row: Record<string, unknown> | null } | { ok: false; retry: boolean };

/**
 * Pushes the outbox (in order) and pulls rows changed since the last sync.
 * Last write wins; local unpushed changes are never overwritten by a pull.
 */
export class SyncEngine {
  private running = false;
  private rerun = false;

  constructor(
    private db: LocalDB,
    private supabase: SupabaseClient<Database>,
    private onRejected: (item: OutboxItem, message: string) => void,
  ) {}

  sync = async () => {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.rerun = false;
        const pushed = await this.push();
        if (!pushed) break; // offline or server trouble: try again on the next trigger
        await this.pull();
      } while (this.rerun);
    } catch (error) {
      console.warn("Sync paused:", error);
    } finally {
      this.running = false;
    }
  };

  /** Returns false if it stopped early because the network/server is unavailable. */
  private async push(): Promise<boolean> {
    const items = await this.db.outbox.orderBy("seq").toArray();
    for (let i = 0; i < items.length;) {
      const batch = takeBatch(items, i);
      i += batch.length;
      let results = batch.length > 1 ? await this.sendBatch(batch) : [await this.send(batch[0])];
      // A rejected batch: retry one by one so only the bad row is dropped.
      if (results === null) results = await Promise.all(batch.map((item) => this.send(item)));

      for (let k = 0; k < batch.length; k++) {
        const item = batch[k];
        const result = results[k];
        if (!result.ok && result.retry) return false;

        const changedMeanwhile = await this.db.transaction(
          "rw",
          this.db.outbox,
          this.db.table(item.table),
          async () => {
            const current = await this.db.outbox.get(item.seq!);
            // Edited while we were sending: keep it (with the newer payload) for the next round.
            if (current && (current.version ?? 0) !== (item.version ?? 0)) return true;
            await this.db.outbox.delete(item.seq!);
            if (result.ok && result.row) await this.db.table(item.table).put(result.row);
            return false;
          },
        );
        if (changedMeanwhile) {
          this.rerun = true;
          continue;
        }

        if (!result.ok) {
          // Rejected for good (e.g. invalid data): drop it and restore the server's copy.
          await this.refetch(item);
          this.onRejected(item, "A change couldn't be saved and was undone.");
        } else if (item.op === "create" && !result.row) {
          // Already on the server (maybe deleted there): keep the server's copy, not ours.
          await this.refetch(item);
        }
      }
    }
    return true;
  }

  private async send(item: OutboxItem): Promise<SendResult> {
    const payload = serverPayload(item);
    const op = item.table === "profiles" ? "update" : (item.op ?? "upsert");
    const table = this.supabase.from(item.table as RowTable);
    const response =
      op === "update"
        ? await table
            .update(payload as never)
            .eq("id", item.rowId)
            .select()
            .maybeSingle()
        : op === "insert"
          ? await table
              .insert(payload as never)
              .select()
              .maybeSingle()
          : await table
              .upsert(payload as never, { ignoreDuplicates: op === "create" })
              .select()
              .maybeSingle();

    if (!response.error) return { ok: true, row: response.data };
    const retry = isTransient(response.status);
    if (!retry) console.error("Sync rejected", item, response.error);
    return { ok: false, retry };
  }

  /** One upsert for many rows of the same table. null = rejected (caller retries singly). */
  private async sendBatch(batch: OutboxItem[]): Promise<SendResult[] | null> {
    const response = await this.supabase
      .from(batch[0].table as RowTable)
      .upsert(batch.map(serverPayload) as never)
      .select();
    if (response.error) {
      if (isTransient(response.status)) return batch.map(() => ({ ok: false, retry: true }));
      return null;
    }
    const rows = new Map((response.data as { id: string }[]).map((row) => [row.id, row]));
    return batch.map((item) => ({ ok: true, row: rows.get(item.rowId) ?? null }));
  }

  private async refetch(item: OutboxItem) {
    const { data, error } = await this.supabase.from(item.table).select("*").eq("id", item.rowId).maybeSingle();
    if (error) return;
    if (data) await this.db.table(item.table).put(data);
    else await this.db.table(item.table).delete(item.rowId);
  }

  /**
   * All tables are fetched in parallel (one round trip of latency instead of ten), then written
   * parent-before-child, so a fresh device never holds an expense whose category is missing.
   */
  private async pull() {
    const pending = new Set((await this.db.outbox.toArray()).map((item) => item.rowId));

    const [profile, groups, members, ...fetched] = await Promise.all([
      this.supabase.from("profiles").select("*").eq("id", this.db.userId).maybeSingle(),
      this.supabase.from("groups").select("*"),
      this.supabase.from("group_members").select("*"),
      ...[...ROW_TABLES, ...GROUP_ROW_TABLES].map((table) => this.fetchTable(table)),
    ]);
    for (const response of [profile, groups, members]) if (response.error) throw response.error;

    if (profile.data && !pending.has(profile.data.id)) await this.db.profiles.put(profile.data);
    const byTable = new Map(fetched.map((f) => [f.table, f]));
    for (const table of ROW_TABLES) await this.applyTable(byTable.get(table)!, pending);

    const groupsChanged = await this.applyGroups(groups.data!, members.data!, pending);
    for (const table of GROUP_ROW_TABLES) {
      // Joined a group: its older expenses predate our cursor, so read those tables afresh.
      await this.applyTable(groupsChanged ? await this.fetchTable(table) : byTable.get(table)!, pending);
    }
    await this.db.meta.put({ key: "initialSyncDone", value: true });
  }

  /**
   * Groups and members are read in full each time (small, and RLS returns exactly the groups
   * you're in), so joining/leaving is picked up at once. Returns true when your set of groups
   * changed (group expense/settlement cursors are then reset).
   */
  private async applyGroups(groups: Group[], members: GroupMember[], pending: Set<string>) {
    const groupIds = new Set(groups.map((g) => g.id));
    await this.db.transaction(
      "rw",
      [
        this.db.groups,
        this.db.group_members,
        this.db.group_expenses,
        this.db.settlements,
        this.db.group_recurring_rules,
      ],
      async () => {
        const stale = async (
          table: "groups" | "group_members" | "group_expenses" | "settlements" | "group_recurring_rules",
          keep: (row: { id: string; group_id?: string }) => boolean,
        ) => {
          const rows = (await this.db.table(table).toArray()) as { id: string; group_id?: string }[];
          await this.db.table(table).bulkDelete(rows.filter((r) => !keep(r) && !pending.has(r.id)).map((r) => r.id));
        };
        const memberIds = new Set(members.map((m) => m.id));
        await stale("groups", (r) => groupIds.has(r.id));
        await stale("group_members", (r) => memberIds.has(r.id));
        await stale("group_expenses", (r) => groupIds.has(r.group_id!));
        await stale("settlements", (r) => groupIds.has(r.group_id!));
        await stale("group_recurring_rules", (r) => groupIds.has(r.group_id!));
        await this.db.groups.bulkPut(groups.filter((g) => !pending.has(g.id)));
        await this.db.group_members.bulkPut(members.filter((m) => !pending.has(m.id)));
      },
    );

    const signature = [...groupIds].sort().join(",");
    if ((await this.db.meta.get("groupIds"))?.value === signature) return false;
    await this.db.meta.bulkDelete(GROUP_ROW_TABLES.map((table) => `cursor:${table}`));
    await this.db.meta.put({ key: "groupIds", value: signature });
    return true;
  }

  /** Rows changed since the table's cursor (paged). Network only; nothing is written yet. */
  private async fetchTable(table: RowTable): Promise<Fetched> {
    const cursor = (await this.db.meta.get(`cursor:${table}`))?.value as string | undefined;
    let from = cursor ? new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString() : null;
    const rows: { id: string; updated_at: string }[] = [];

    for (;;) {
      let query = this.supabase.from(table).select("*").order("updated_at").order("id").limit(PAGE_SIZE);
      if (from) query = query.gte("updated_at", from);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data as { id: string; updated_at: string }[]));
      const last = data[data.length - 1];
      if (data.length < PAGE_SIZE || last.updated_at === data[0].updated_at) break;
      from = last.updated_at;
    }
    return { table, rows, latest: rows.length ? rows[rows.length - 1].updated_at : cursor };
  }

  private async applyTable({ table, rows, latest }: Fetched, pending: Set<string>) {
    const fresh = rows.filter((row) => !pending.has(row.id));
    if (fresh.length) await this.db.table(table).bulkPut(fresh);
    if (latest) await this.db.meta.put({ key: `cursor:${table}`, value: latest });
  }
}
