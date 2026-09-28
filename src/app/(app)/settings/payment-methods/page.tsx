import type { Metadata } from "next";
import { PaymentMethodsScreen } from "@/components/settings/payment-methods-screen";

export const metadata: Metadata = { title: "Payment methods" };

export default function PaymentMethodsPage() {
  return <PaymentMethodsScreen />;
}
