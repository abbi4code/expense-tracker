/** Only same-site paths are allowed as post-login destinations (no open redirects). */
export function safeNext(value: string | null | undefined, fallback = "/home"): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}
