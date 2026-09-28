// Currency choices for onboarding/settings, and a best guess from the device locale.

export const POPULAR_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "CAD", "AUD", "JPY"];

// Region (from the locale, e.g. "en-IN" → "IN") → currency. Covers the common cases.
const REGION_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SG: "SGD",
  CA: "CAD",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  CN: "CNY",
  HK: "HKD",
  KR: "KRW",
  ID: "IDR",
  MY: "MYR",
  TH: "THB",
  PH: "PHP",
  VN: "VND",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  ZA: "ZAR",
  NG: "NGN",
  KE: "KES",
  BR: "BRL",
  MX: "MXN",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  TR: "TRY",
  RU: "RUB",
  IL: "ILS",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  IE: "EUR",
  PT: "EUR",
  BE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
};

export function guessCurrency(): string {
  if (typeof navigator === "undefined") return "USD";
  for (const locale of navigator.languages ?? [navigator.language]) {
    const region = new Intl.Locale(locale).maximize().region;
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return "USD";
}

export function allCurrencies(): string[] {
  try {
    return Intl.supportedValuesOf("currency");
  } catch {
    return POPULAR_CURRENCIES;
  }
}

export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}
