// Category colours: a soft background + strong foreground per theme. Stored by name in the DB.

type Swatch = { light: [bg: string, fg: string]; dark: [bg: string, fg: string] };

export const CATEGORY_COLORS: Record<string, Swatch> = {
  orange: { light: ["#fde8d7", "#c2410c"], dark: ["#3b2416", "#fb923c"] },
  amber: { light: ["#fcefc7", "#b45309"], dark: ["#382b12", "#fbbf24"] },
  lime: { light: ["#e6f5c9", "#4d7c0f"], dark: ["#26301a", "#a3e635"] },
  emerald: { light: ["#d5f2e3", "#047857"], dark: ["#15302a", "#34d399"] },
  cyan: { light: ["#d3f0f5", "#0e7490"], dark: ["#132d33", "#22d3ee"] },
  sky: { light: ["#dbeefb", "#0369a1"], dark: ["#15283a", "#38bdf8"] },
  indigo: { light: ["#e2e5fb", "#4338ca"], dark: ["#1f2140", "#818cf8"] },
  violet: { light: ["#ebe3fc", "#6d28d9"], dark: ["#281f40", "#a78bfa"] },
  fuchsia: { light: ["#f8e0f9", "#a21caf"], dark: ["#361d38", "#e879f9"] },
  pink: { light: ["#fbe1ec", "#be185d"], dark: ["#3a1c2a", "#f472b6"] },
  rose: { light: ["#fde2e4", "#be123c"], dark: ["#3a1b21", "#fb7185"] },
  red: { light: ["#fde0dc", "#b91c1c"], dark: ["#3a1a18", "#f87171"] },
  slate: { light: ["#e7e8ea", "#475569"], dark: ["#25272b", "#94a3b8"] },
};

export const COLOR_NAMES = Object.keys(CATEGORY_COLORS);

/** CSS variables for a category colour; pair with the `.cat-*` utilities in globals.css. */
export function categoryStyle(color: string): React.CSSProperties {
  const swatch = CATEGORY_COLORS[color] ?? CATEGORY_COLORS.slate;
  return {
    "--cat-bg-light": swatch.light[0],
    "--cat-fg-light": swatch.light[1],
    "--cat-bg-dark": swatch.dark[0],
    "--cat-fg-dark": swatch.dark[1],
  } as React.CSSProperties;
}

export const CATEGORY_EMOJIS = [
  "🍔",
  "🍕",
  "☕",
  "🍺",
  "🥗",
  "🛒",
  "🚕",
  "🚌",
  "⛽",
  "🚗",
  "✈️",
  "🏨",
  "🏠",
  "💡",
  "📱",
  "🌐",
  "🛍️",
  "👕",
  "👟",
  "💄",
  "💅",
  "💊",
  "🏥",
  "🏋️",
  "🎬",
  "🎮",
  "🎵",
  "📚",
  "🎓",
  "🎁",
  "🐶",
  "👶",
  "🧾",
  "💳",
  "🏦",
  "📈",
  "🔧",
  "🧹",
  "🪴",
  "💼",
  "🎉",
  "❤️",
  "🙏",
  "🚬",
  "💸",
  "📦",
];
