import { TestFlowProvider } from "./_components/test-flow-provider";
import { StepNav } from "./_components/step-nav";
import { MainHeader } from "../_components/main-header";
import { TestStepHelp } from "./_components/test-step-help";

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestFlowProvider>
      <div className="min-h-screen bg-slate-50">
        {/* 공통 상단 헤더 */}
        <MainHeader />
        
        <section className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-4 py-3 md:py-6">
            <header className="space-y-2">
              <span className="inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                기능 체험
              </span>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">기능 체험 · 검색/AI 분석 → 제품 비교 → 견적 요청</h1>
              <p className="mt-2 text-sm text-slate-600 hidden md:block">
                샘플 데이터로 실제 검색/AI 분석/제품 비교/견적 요청 작성 흐름을 체험해 보세요.
              </p>
              
              {/* 단계 설명 및 안내 */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500">검색/AI 분석 → 제품 비교 → 견적 요청</span>
                <TestStepHelp />
              </div>
            </header>

            <div className="mt-4">
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