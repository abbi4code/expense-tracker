"use client";

import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackHeader } from "@/components/app/back-header";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import type { PaymentMethod } from "@/lib/db/local";
import { createPaymentMethod, deletePaymentMethod, renamePaymentMethod } from "@/lib/db/mutations";
import { usePaymentMethods } from "@/lib/db/queries";
import { SettingsRow } from "./settings-group";

export function PaymentMethodsScreen() {
  const { db } = useData();
  const methods = usePaymentMethods();
  const [editing, setEditing] = useState<{ open: boolean; method: PaymentMethod | null }>({
    open: false,
    method: null,
  });
  const close = () => setEditing((s) => ({ ...s, open: false }));

  async function save(name: string) {
    if (!name.trim()) return toast.error("Give it a name.");
    if (editing.method) await renamePaymentMethod(db, editing.method, name);
    else await createPaymentMethod(db, name);
    close();
  }

  async function remove() {
    if (!editing.method) return;
    await deletePaymentMethod(db, editing.method);
    toast(`Deleted ${editing.method.name}`);
    close();
  }

  return (
    <>
      <BackHeader
        href="/settings"
        backLabel="Settings"
        title="Payment methods"
        action={
          <Button size="sm" onClick={() => setEditing({ open: true, method: null })}>
            <Plus className="size-4" /> New
          </Button>
        }
      />

      {methods?.length === 0 ? (
        <EmptyState emoji="💳" title="No payment methods" description="Add Cash, a card or UPI to track how you pay." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {methods?.map((method) => (
            <SettingsRow
              key={method.id}
              icon={<Wallet className="size-[18px]" />}
              label={method.name}
              onClick={() => setEditing({ open: true, method })}
            />
          ))}
        </div>
      )}

      <Sheet
        open={editing.open}
        onOpenChange={(open) => !open && close()}
        title={editing.method ? "Edit payment method" : "New payment method"}
      >
        <form
          key={editing.method?.id ?? `new-${editing.open}`}
          onSubmit={(e) => {
            e.preventDefault();
            save(String(new FormData(e.currentTarget).get("name") ?? ""));
          }}
          className="space-y-3"
        >
          <Input
            name="name"
            defaultValue={editing.method?.name}
            placeholder="e.g. HDFC card"
            maxLength={40}
            autoFocus
            aria-label="Name"
          />
          <Button type="submit" size="lg" className="w-full">
            {editing.method ? "Save" : "Add"}
          </Button>
          {editing.method && (
            <Button type="button" variant="danger" size="lg" className="w-full" onClick={remove}>
              Delete
            </Button>
          )}
        </form>
      </Sheet>
    </>
  );
}
