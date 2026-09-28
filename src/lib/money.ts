// Money is stored as integer minor units (paise/cents). These helpers convert and format.

const fractionCache = new Map<string, number>();

/** Number of decimal places a currency uses (INR/USD 2, JPY 0). */
export function fractionDigits(currency: string): number {
  let digits = fractionCache.get(currency);
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    fractionCache.set(currency, digits);
  }
  return digits;
}

/** Rounds down to a whole unit (₹4,266.66 → ₹4,266) for estimates where paise are noise. */
export function floorToWhole(minor: number, currency: string): number {
  const unit = 10 ** fractionDigits(currency);
  return Math.floor(minor / unit) * unit;
}

export function roundToWhole(minor: number, currency: string): number {
  const unit = 10 ** fractionDigits(currency);
  return Math.round(minor / unit) * unit;
}

export function toMinor(amount: number, currency: string): number {
  return Math.round(amount * 10 ** fractionDigits(currency));
}

export function fromMinor(minor: number, currency: string): number {
  return minor / 10 ** fractionDigits(currency);
}

type FormatOptions = {
  /** Drop ".00" on whole amounts (default true). */
  trimZeros?: boolean;
  /** Short form for tight spaces: ₹12.4K. */
  compact?: boolean;
  signDisplay?: Intl.NumberFormatOptions["signDisplay"];
};

export function formatMoney(minor: number, currency: string, options: FormatOptions = {}): string {
  const { trimZeros = true, compact = false, signDisplay } = options;
  const value = fromMinor(minor, currency);
  const whole = Number.isInteger(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact || (trimZeros && whole) ? 0 : undefined,
    maximumFractionDigits: compact ? 1 : undefined,
    signDisplay,
  }).format(value);
}

/** The currency symbol on its own, e.g. "₹". */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

/** Formats a plain number with grouping (no symbol), for the number pad display. */
export function formatPlain(text: string): string {
  const [int, dec] = text.split(".");
  const grouped = new Intl.NumberFormat().format(Number(int || "0"));
  return dec === undefined ? grouped : `${grouped}.${dec}`;
}
