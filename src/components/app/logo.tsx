import { cn } from "@/lib/utils";

/** The app mark: three stacked bars (same drawing as the app icon). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("size-10", className)} aria-hidden>
      <rect width="512" height="512" rx="128" fill="#161513" />
      <rect x="136" y="160" width="240" height="56" rx="28" fill="#c8f169" />
      <rect x="136" y="228" width="176" height="56" rx="28" fill="#f3f1ec" fillOpacity="0.85" />
      <rect x="136" y="296" width="112" height="56" rx="28" fill="#f3f1ec" fillOpacity="0.45" />
    </svg>
  );
}
