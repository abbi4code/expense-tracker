import { redirect } from "next/navigation";
import { AddExpenseButton } from "@/components/app/add-expense-button";
import { TabBar } from "@/components/app/tab-bar";
import { DataProvider } from "@/components/data/data-provider";
import { ExpenseSheetProvider } from "@/components/expenses/expense-sheet";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle();
  if (profile && !profile.onboarded_at) redirect("/welcome");

  return (
    <DataProvider userId={userId}>
      <ExpenseSheetProvider>
        <main
          className="mx-auto w-full max-w-lg px-5 pt-safe"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem + 6rem)" }}
        >
          {children}
        </main>
        <AddExpenseButton />
        <TabBar />
      </ExpenseSheetProvider>
    </DataProvider>
  );
}
