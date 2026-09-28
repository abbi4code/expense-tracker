import type { Metadata } from "next";
import { CheckEmail } from "@/components/auth/check-email";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email, unconfirmed } = await searchParams;
  return <CheckEmail email={typeof email === "string" ? email : ""} unconfirmed={unconfirmed === "1"} />;
}
