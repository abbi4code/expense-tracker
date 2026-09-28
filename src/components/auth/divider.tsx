export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-subtle">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
