import type { Metadata } from "next";
import { BudgetsScreen } from "@/components/settings/budgets-screen";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return <BudgetsScreen />;
}
