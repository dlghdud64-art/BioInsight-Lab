import { TestFlowProvider } from "./_components/test-flow-provider";
import { StepNav } from "./_components/step-nav";
import { MainHeader } from "../_components/main-header";

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return (
    <TestFlowProvider>
      <div className="min-h-screen bg-slate-50">
        {/* 공통 상단 헤더 */}
        <MainHeader />
        
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          <header className="space-y-2">
            <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              테스트 환경
            </span>
            <h1 className="text-2xl font-bold text-slate-900">기능 테스트 플로우</h1>
            <p className="text-sm text-slate-600">
              검색/AI 분석 → 제품 비교 → 품목 리스트 → 프로토콜 분석까지 실제 사용자 플로우를 단계별로 테스트합니다.
            </p>
          </header>

          <StepNav />
          <main>{children}</main>
        </div>
      </div>
    </TestFlowProvider>
  );
}