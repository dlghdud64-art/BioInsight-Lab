type TestLayoutProps = {
  children: React.ReactNode;
};

export function TestLayout({ children }: TestLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {children}
      </div>
    </div>
  );
}







