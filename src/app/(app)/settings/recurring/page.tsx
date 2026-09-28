import type { Metadata } from "next";
import { RecurringScreen } from "@/components/settings/recurring-screen";

export const metadata: Metadata = { title: "Recurring" };

export default function RecurringPage() {
  return <RecurringScreen />;
}
