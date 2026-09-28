import type { Metadata } from "next";
import { DataScreen } from "@/components/settings/data-screen";

export const metadata: Metadata = { title: "Export & import" };

export default function DataPage() {
  return <DataScreen />;
}
