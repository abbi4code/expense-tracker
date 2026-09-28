"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthHeading } from "./auth-heading";
import { authCallbackUrl } from "./redirect-url";
import { ResendButton } from "./resend-button";

type CheckEmailProps = { email: string; unconfirmed?: boolean };

export function CheckEmail({ email, unconfirmed }: CheckEmailProps) {
  if (!email) {
    return (
      <AuthHeading
        title="Missing email"
        subtitle={
          <>
            Start again from the{" "}
            <Link href="/signup" className="font-semibold text-ink underline">
              sign up
            </Link>{" "}
            page.
          </>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-6 grid size-20 place-items-center rounded-[1.75rem] border border-line bg-surface text-4xl">
        📬
      </div>
      <AuthHeading
        title={unconfirmed ? "Confirm your email first" : "Check your email"}
        subtitle={
          <>
            {unconfirmed ? "We sent a confirmation link to " : "We've sent a confirmation link to "}
            <span className="font-medium text-ink">{email}</span>. Tap it to finish signing up.
          </>
        }
      />
      <ul className="space-y-2 text-[15px] leading-relaxed text-muted">
        <li>• Only the newest email&apos;s link works. Resending makes older links stop working.</li>
        <li>• Can&apos;t find it? Check spam or promotions.</li>
      </ul>
      <div className="mt-8">
        <ResendButton
          startWithCooldown={!unconfirmed}
          onResend={() =>
            createClient().auth.resend({
              type: "signup",
              email,
              options: { emailRedirectTo: authCallbackUrl("/home") },
            })
          }
        />
      </div>
      <p className="mt-8 text-[15px] text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="font-semibold text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
