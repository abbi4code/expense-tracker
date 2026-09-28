import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_ROUTES, AUTH_ROUTES } from "@/lib/config";
import { safeNext } from "@/lib/safe-next";
import type { Database } from "./database.types";

const matches = (pathname: string, routes: string[]) =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

// Refreshes the auth session cookie and applies optimistic route guards.
export async function updateSession(request: NextRequest) {
  // If an email link's redirect URL isn't in Supabase's allow-list, Supabase falls back to the
  // Site URL ("/"). Hand those results to the callback so they're still handled.
  const { pathname: path, searchParams } = request.nextUrl;
  if (path === "/" && (searchParams.has("code") || searchParams.has("error_code"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Remember where they were going (e.g. an invite link) and return there after signing in.
  if (!signedIn && matches(pathname, APP_ROUTES)) {
    const next = pathname === "/home" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return redirectTo("/login", next);
  }
  if (signedIn && (pathname === "/" || matches(pathname, AUTH_ROUTES))) {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    return redirectTo(next.split("?")[0], next.includes("?") ? `?${next.split("?")[1]}` : "");
  }

  return response;
}
