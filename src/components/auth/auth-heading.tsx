export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}
