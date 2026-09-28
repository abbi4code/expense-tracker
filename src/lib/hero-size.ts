/** Font size for a hero amount so long values (₹12,50,000.50) still fit on a 320px phone. */
export function heroTextClass(text: string) {
  if (text.length <= 8) return "text-[3.25rem]";
  if (text.length <= 11) return "text-[2.6rem]";
  return "text-[2.1rem]";
}
