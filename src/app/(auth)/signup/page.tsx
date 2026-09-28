import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  return <SignupForm next={safeNext(typeof next === "string" ? next : null)} />;
}
