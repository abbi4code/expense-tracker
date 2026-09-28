"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authErrorMessage } from "./auth-errors";

const COOLDOWN_SECONDS = 60;

type ResendButtonProps = {
  onResend: () => Promise<{ error: Error | null }>;
  /** Start counting down immediately (an email was just sent). */
  startWithCooldown?: boolean;
};

/** "Resend email" link with a cooldown so users don't hit the email rate limit. */
export function ResendButton({ onResend, startWithCooldown = true }: ResendButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(startWithCooldown ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function resend() {
    setSecondsLeft(COOLDOWN_SECONDS);
    const { error } = await onResend();
    if (error) toast.error(authErrorMessage(error));
    else toast.success("New link sent. Check your inbox.");
  }

  return (
    <button
      type="button"
      onClick={resend}
      disabled={secondsLeft > 0}
      className="text-[15px] font-semibold text-ink underline-offset-4 hover:underline disabled:font-normal disabled:text-subtle disabled:no-underline"
    >
      {secondsLeft > 0 ? `Resend email in ${secondsLeft}s` : "Resend email"}
    </button>
  );
}
