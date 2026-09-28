import type { AuthError } from "@supabase/supabase-js";

const messages: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Try again or reset your password.",
  email_not_confirmed: "Please verify your email first.",
  user_already_exists: "An account with this email already exists. Log in instead.",
  email_exists: "An account with this email already exists. Log in instead.",
  weak_password: "Use at least 8 characters with both letters and numbers.",
  otp_expired: "That code is wrong or has expired. Check the latest email or request a new code.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a minute and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a minute and try again.",
  email_address_invalid: "That email address doesn't look right.",
  validation_failed: "Please check the details and try again.",
  provider_disabled: "This sign-in method isn't enabled yet.",
  same_password: "Your new password must be different from the old one.",
};

export function authErrorMessage(error: AuthError | Error): string {
  const code = "code" in error ? error.code : undefined;
  if (code && messages[code]) return messages[code];
  if (/fetch|network/i.test(error.message)) return "Can't reach the server. Check your connection.";
  return error.message || "Something went wrong. Please try again.";
}
