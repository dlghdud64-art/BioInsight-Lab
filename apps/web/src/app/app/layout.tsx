import { TestFlowProvider } from "../test/_components/test-flow-provider";
import { MainHeader } from "../_components/main-header";
import { StepNav } from "./step-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestFlowProvider>
      <div className="min-h-screen bg-[#111114]">
        <MainHeader />
        <StepNav />

        <div className="pt-[calc(3.5rem+2.5rem)] md:pt-[calc(3.5rem+5rem+1rem)] mx-auto max-w-6xl px-4 py-2 md:py-8 space-y-4 md:space-y-6">
          <main>{children}</main>
        </div>
      </div>
    </TestFlowProvider>
  );
}
