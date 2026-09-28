const ordinal = (n: number) => {
  const suffix =
    n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
};

export const MONTH_START_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);

export function monthStartLabel(day: number) {
  return day === 1 ? "1st (calendar month)" : `${ordinal(day)} of each month`;
}

type MonthStartSelectProps = { value: number; onChange: (day: number) => void; id?: string };

export function MonthStartSelect({ value, onChange, id }: MonthStartSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-13 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink"
    >
      {MONTH_START_OPTIONS.map((day) => (
        <option key={day} value={day}>
          {monthStartLabel(day)}
        </option>
      ))}
    </select>
  );
}
