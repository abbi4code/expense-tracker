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

// Emoji for a category created from the picker's search ("Coffee" → ☕). Fallback: a tag.
const EMOJI_HINTS: [RegExp, string][] = [
  [/coffee|cafe|chai|tea/i, "☕"],
  [/food|lunch|dinner|snack|restaurant|eat/i, "🍔"],
  [/drink|bar|beer|alcohol/i, "🍺"],
  [/grocer|vegetable|fruit|milk/i, "🛒"],
  [/cab|taxi|uber|ola|auto|metro|bus|commute/i, "🚕"],
  [/fuel|petrol|diesel/i, "⛽"],
  [/car|bike|vehicle/i, "🚗"],
  [/flight|travel|trip|holiday|vacation/i, "✈️"],
  [/hotel|stay/i, "🏨"],
  [/rent|house|home|flat/i, "🏠"],
  [/electric|bill|utility|water|gas/i, "💡"],
  [/phone|mobile|recharge/i, "📱"],
  [/internet|wifi|broadband/i, "🌐"],
  [/subscription|netflix|spotify|prime|ott/i, "🔁"],
  [/cloth|shirt|fashion|shoe/i, "👕"],
  [/shop|amazon|flipkart/i, "🛍️"],
  [/health|medic|doctor|pharma|hospital/i, "💊"],
  [/gym|fitness|sport|yoga/i, "🏋️"],
  [/beauty|salon|hair|makeup|spa/i, "💅"],
  [/movie|cinema|entertain|game|concert/i, "🎬"],
  [/music/i, "🎵"],
  [/book|course|educat|school|college|fees|tuition/i, "📚"],
  [/gift|present/i, "🎁"],
  [/pet|dog|cat/i, "🐶"],
  [/kid|baby|child/i, "👶"],
  [/party|celebrat/i, "🎉"],
  [/donat|charity|temple/i, "🙏"],
  [/emi|loan|bank|fee|tax|insurance/i, "🏦"],
  [/invest|stock|mutual|sip/i, "📈"],
  [/repair|maintenance|plumb|electrician/i, "🔧"],
  [/clean|laundry|maid|help/i, "🧹"],
  [/work|office|business/i, "💼"],
  [/salary|income|freelance/i, "💰"],
];

export function guessEmoji(name: string): string {
  return EMOJI_HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? "🏷️";
}

/** The colour fewest categories use, so a new category stands apart. */
export function leastUsedColor(categories: { color: string }[]): string {
  const counts = new Map(COLOR_NAMES.map((c) => [c, 0]));
  for (const c of categories) if (counts.has(c.color)) counts.set(c.color, counts.get(c.color)! + 1);
  return [...counts].sort((a, b) => a[1] - b[1])[0][0];
}
