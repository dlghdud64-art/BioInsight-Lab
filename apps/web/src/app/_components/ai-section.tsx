import { Search, GitCompare, FileText } from "lucide-react";

// AI 보조 레이어 — 독립 쇼케이스가 아니라 워크플로우 내 inline helper
export function AISection() {
  return (
    <section id="ai" className="py-8 md:py-10 border-b border-bd bg-pg">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">AI Assist</p>
          <h2 className="text-base md:text-lg font-semibold tracking-tight text-slate-100">
            검색·비교·요청 흐름 안의 보조 레이어
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            AI가 다음 단계를 준비하고, 사용자가 승인하면 시스템이 실행합니다.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-bd bg-pn p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/15 shrink-0">
                <Search className="h-3 w-3 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">검색 요약</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              비교 적합 후보, 요청 전환 필요 품목, 주의 신호를 1~2줄로 요약합니다.
            </p>
          </div>

          <div className="rounded-lg border border-bd bg-pn p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/15 shrink-0">
                <GitCompare className="h-3 w-3 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">비교 판단 요약</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              현재 비교 모드 기준으로 추천 선택안과 다음 액션을 제안합니다.
            </p>
          </div>

          <div className="rounded-lg border border-bd bg-pn p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/15 shrink-0">
                <FileText className="h-3 w-3 text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">요청서 초안 생성</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              납기 요청, 대체 가능 여부 문의, 첨부 안내가 포함된 메시지 초안을 자동으로 준비합니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
