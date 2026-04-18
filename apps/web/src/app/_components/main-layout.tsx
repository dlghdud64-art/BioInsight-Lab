import { MobileFloatingCTA } from "./mobile-floating-cta";

type MainLayoutProps = {
  children: React.ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-public-brand-field-strong pb-20 md:pb-0">
      {children}
      <MobileFloatingCTA />
    </div>
  );
}



