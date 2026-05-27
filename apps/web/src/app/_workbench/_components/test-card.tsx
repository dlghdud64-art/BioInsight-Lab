type TestCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function TestCard({ title, subtitle, children }: TestCardProps) {
  return (
    <div className="rounded-lg border border-bd bg-pn p-4">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
