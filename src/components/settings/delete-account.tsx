"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useData } from "@/components/data/data-provider";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { deleteAllReceipts } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/client";
import { clearDeviceData } from "./sign-out-button";

export function DeleteAccount() {
  const router = useRouter();
  const { db } = useData();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function deleteAccount() {
    setLoading(true);
    const supabase = createClient();
    // Photos live in Storage, which the account's database cascade doesn't reach.
    const receiptsGone = await deleteAllReceipts(db.userId).then(
      () => true,
      () => false,
    );
    const { error } = receiptsGone ? await supabase.rpc("delete_account") : { error: new Error("receipts") };
    if (error) {
      setLoading(false);
      return toast.error("Couldn't delete your account. Check your connection and try again.");
    }
    await supabase.auth.signOut();
    await clearDeviceData(db.userId);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" size="lg" className="w-full" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="This permanently deletes your account and every expense, category and setting. It can't be undone."
      >
        <div className="space-y-3">
          <Button variant="danger" size="lg" className="w-full" loading={loading} onClick={deleteAccount}>
            Delete everything
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setOpen(false)}>
            Keep my account
          </Button>
        </div>
      </Sheet>
    </>
  );
}
