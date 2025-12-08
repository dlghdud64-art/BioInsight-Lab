type TestCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function TestCard({ title, subtitle, children }: TestCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}



  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function TestCard({ title, subtitle, children }: TestCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}



  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function TestCard({ title, subtitle, children }: TestCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <p className="text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}






