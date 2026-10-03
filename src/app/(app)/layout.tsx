import { AddExpenseButton } from "@/components/app/add-expense-button";
import { TabBar } from "@/components/app/tab-bar";
import { DataProvider } from "@/components/data/data-provider";
import { ExpenseSheetProvider } from "@/components/expenses/expense-sheet";
import { Skeleton } from "@/components/ui/skeleton";

// Static on purpose: pages render from the on-device data, so navigating needs no server work.
// Signed-out visitors are redirected by the proxy; first-run setup is checked in DataProvider.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DataProvider fallback={<ShellFallback />}>
        <ExpenseSheetProvider>
          <Main>{children}</Main>
          <AddExpenseButton />
        </ExpenseSheetProvider>
      </DataProvider>
      <TabBar />
    </>
  );
}

function Main({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="mx-auto w-full max-w-lg px-5 pt-safe"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4rem + 6rem)" }}
    >
      {children}
    </main>
  );
}

/** Shown for a moment before the account is known (first visit on a device). */
function ShellFallback() {
  return (
    <Main>
      <div className="h-16" />
      <Skeleton className="h-48" />
      <div className="mt-7 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </Main>
  );
}
