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
import { PASSWORD_HINT, isStrongEnough } from "./password-rules";
import { authCallbackUrl } from "./redirect-url";

export function SignupForm({ next = "/home" }: { next?: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Inputs are uncontrolled and read on submit, so anything typed before hydration isn't lost.
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (!email) return setError("Enter your email.");
    if (!isStrongEnough(password)) return setError(PASSWORD_HINT);
    if (password !== confirmPassword) return setError("The passwords don't match.");
    setLoading(true);
    setError("");
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || null },
        emailRedirectTo: authCallbackUrl(next),
      },
    });

    if (error) {
      setError(authErrorMessage(error));
      setLoading(false);
      return;
    }
    // With email confirmation on, an existing email returns a user with no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      setError("An account with this email already exists. Log in instead.");
      setLoading(false);
      return;
    }
    // Email confirmation off (the default here): the user is signed in straight away.
    if (data.session) {
      router.replace(next === "/home" ? "/welcome" : next);
      router.refresh();
      return;
    }
    router.push(`/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Takes 30 seconds. Your first expense right after." />
      <GoogleButton label="Sign up with Google" next={next} />
      <div className="my-6">
        <Divider label="or with email" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="given-name"
            placeholder="What should we call you?"
            maxLength={60}
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="mt-1.5 text-sm text-subtle">
            {PASSWORD_HINT}
          </p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-muted">
        Already have an account?{" "}
        <Link
          href={next === "/home" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
