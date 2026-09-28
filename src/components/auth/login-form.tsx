"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import { AuthHeading } from "./auth-heading";
import { authErrorMessage } from "./auth-errors";
import { Divider } from "./divider";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";

type LoginFormProps = { initialError?: string; notice?: string; next?: string };

export function LoginForm({ initialError, notice, next = "/home" }: LoginFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(false);

  // Inputs are uncontrolled and read on submit, so anything typed before hydration isn't lost.
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) return setError("Enter your email and password.");
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // Don't auto-resend here: every new email invalidates the previous link.
    if (error?.code === "email_not_confirmed") {
      router.push(`/check-email?email=${encodeURIComponent(email)}&unconfirmed=1`);
      return;
    }
    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Log in to keep tracking your spending." />
      {notice && (
        <p role="status" className="mb-6 rounded-2xl bg-success/10 px-4 py-3 text-[15px] text-success">
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm font-medium text-muted underline-offset-4 hover:underline">
              Forgot?
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
          Log in
        </Button>
      </form>
      <div className="my-6">
        <Divider />
      </div>
      <GoogleButton next={next} />
      <p className="mt-8 text-center text-[15px] text-muted">
        New here?{" "}
        <Link
          href={next === "/home" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
