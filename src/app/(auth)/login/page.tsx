import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Log in" };

const errors: Record<string, string> = {
  oauth: "Sign-in didn't complete. Please try again.",
  link_expired:
    "That link has expired or was already used. Log in with your password, and if your email isn't confirmed yet we'll help you get a new link.",
  reset_link: "That reset link has expired or was opened in a different browser. Request a new one below.",
};

const notices: Record<string, string> = {
  confirmed: "If you just confirmed your email, you're all set. Log in to continue.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, notice, next } = await searchParams;
  return (
    <LoginForm
      initialError={typeof error === "string" ? (errors[error] ?? errors.oauth) : undefined}
      notice={typeof notice === "string" ? notices[notice] : undefined}
      next={safeNext(typeof next === "string" ? next : null)}
    />
  );
}
