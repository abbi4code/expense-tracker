"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";
import { AuthHeading } from "./auth-heading";
import { authErrorMessage } from "./auth-errors";
import { PasswordInput } from "./password-input";
import { PASSWORD_HINT, isStrongEnough } from "./password-rules";

/** Reached from the reset email link; the callback has already signed the user in. */
export function ResetPasswordForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (!isStrongEnough(password)) return setError(PASSWORD_HINT);
    if (password !== form.get("confirmPassword")) return setError("The passwords don't match.");
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setLoading(false);
      return setError(authErrorMessage(error));
    }
    toast.success("Password updated.");
    router.replace("/home");
    router.refresh();
  }

  return (
    <>
      <AuthHeading title="Set a new password" />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" name="password" autoComplete="new-password" aria-describedby="password-hint" />
          <p id="password-hint" className="mt-1.5 text-sm text-subtle">
            {PASSWORD_HINT}
          </p>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
          Update password
        </Button>
      </form>
    </>
  );
}
