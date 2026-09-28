"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import { AuthHeading } from "./auth-heading";
import { authErrorMessage } from "./auth-errors";
import { authCallbackUrl } from "./redirect-url";
import { ResendButton } from "./resend-button";

export function ForgotPasswordForm() {
  const hydrated = useHydrated();
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sendLink = (email: string) =>
    createClient().auth.resetPasswordForEmail(email, { redirectTo: authCallbackUrl("/reset-password") });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return setError("Enter your email.");
    setLoading(true);
    setError("");
    const { error } = await sendLink(email);
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <>
        <div className="mb-6 grid size-20 place-items-center rounded-[1.75rem] border border-line bg-surface text-4xl">
          🔑
        </div>
        <AuthHeading
          title="Check your email"
          subtitle={
            <>
              If an account exists for <span className="font-medium text-ink">{sentTo}</span>, we&apos;ve sent a link to
              reset your password. Open it on this device.
            </>
          }
        />
        <ResendButton onResend={() => sendLink(sentTo)} />
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password" subtitle="We'll email you a link to set a new one." />
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
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
          Send reset link
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
