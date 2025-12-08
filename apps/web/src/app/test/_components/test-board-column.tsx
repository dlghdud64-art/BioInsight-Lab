type TestBoardColumnProps = {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function TestBoardColumn({
  step,
  title,
  description,
  children,
}: TestBoardColumnProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {step}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Step {step}. {title}
          </div>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </div>
  );
}



  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function TestBoardColumn({
  step,
  title,
  description,
  children,
}: TestBoardColumnProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {step}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Step {step}. {title}
          </div>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </div>
  );
}



  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function TestBoardColumn({
  step,
  title,
  description,
  children,
}: TestBoardColumnProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {step}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Step {step}. {title}
          </div>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">{children}</div>
    </div>
  );
}





