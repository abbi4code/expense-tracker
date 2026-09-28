/** Where Supabase sends users back to after an email link or OAuth sign-in. */
export function authCallbackUrl(next: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
