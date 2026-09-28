import { NextResponse, type NextRequest } from "next/server";
import { safeNext as safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// Email links (signup confirmation, password reset) and Google sign-in land here.
// Success brings a one-time `code` to exchange for a session; failures bring `error_code`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  // Only allow same-site relative redirects.
  const safeNext = safeNextPath(next);
  const isReset = safeNext === "/reset-password";
  const toLogin = (params: string) => NextResponse.redirect(`${origin}/login?${params}`);

  if (searchParams.get("error_code") === "otp_expired") {
    return toLogin(isReset ? "error=reset_link" : "error=link_expired");
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);

    // The exchange needs the browser that started the flow. Opened elsewhere (e.g. the email
    // app's browser), a signup link has still confirmed the email, so the user can just log in.
    if (isReset) return toLogin("error=reset_link");
    return toLogin("notice=confirmed");
  }

  return toLogin("error=oauth");
}
