import { TestFlowProvider } from "./_components/test-flow-provider";
import { StepNav } from "./_components/step-nav";
import { MainHeader } from "../_components/main-header";

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestFlowProvider>
      <div className="min-h-screen bg-slate-50">
        {/* 공통 상단 헤더 */}
        <MainHeader />
        
        <section className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2 md:py-3">
            <div className="mt-2">
              <StepNav />
            </div>
          </div>
        </section>
        
        <div className="mx-auto max-w-6xl px-4 py-4 md:py-8 space-y-4 md:space-y-6">
          <main>{children}</main>
        </div>
      </div>
    </TestFlowProvider>
  );
}