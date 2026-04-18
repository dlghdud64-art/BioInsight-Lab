import {
  Search, GitCompare, FileText, Package,
  ArrowDown,
} from "lucide-react";

const FLOW_STEPS = [
  {
    icon: Search,
    title: "검색",
    input: "시약명, CAS No., 카탈로그 번호",
    criteria: "글로벌 공급사 500만+ 품목에서 검색, 스펙 확인",
    action: "대체품 후보 선정 → 비교 큐 추가",
    result: "비교 대상 품목 확정",
  },
  {
    icon: GitCompare,
    title: "비교·판단",
    input: "검색에서 선정된 후보 품목",
    criteria: "스펙, 가격, 리드타임, 벤더 신뢰도 비교",
    action: "판정 완료 → 견적 요청 또는 대체품 재검토",
    result: "최적 품목 확정, 견적 발송 준비",
  },
  {
    icon: FileText,
    title: "견적·발주",
    input: "판정된 품목 + 수량 + 공급사",
    criteria: "예산 범위, 승인 기준, 납기 요건 확인",
    action: "견적 수신 → 승인 → 발주 전환",
    result: "발주 확정, 입고 대기 상태 전환",
  },
  {
    icon: Package,
    title: "입고·재고 운영",
    input: "발주 품목의 입고 정보",
    criteria: "수량 검수, Lot 번호, 유효기한, 보관 위치",
    action: "입고 등록 → 재고 반영 → 안전재고 확인",
    result: "재고 운영 상태 갱신, 재주문 필요 시 알림",
  },
];

export function OpsFlowSection() {
  return (
    <section className="py-16 md:py-24 bg-sh">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-3">
            Operations Pipeline
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-tight break-keep">
            연구 구매 운영이 끊기지 않도록,
            <br />단계마다 다음 액션까지 연결합니다
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-0">
          {FLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={step.title}>
                <div className="bg-pg border border-bd rounded-md p-4 md:p-5">
                  {/* Step Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-md bg-pn border border-bd flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-[#9ca3af]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4b5563]">Step {idx + 1}</span>
                      <h3 className="text-sm font-semibold text-slate-100">{step.title}</h3>
                    </div>
                  </div>

                  {/* Step Detail Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#4b5563] mb-0.5">입력 데이터</p>
                        <p className="text-xs text-[#9ca3af]">{step.input}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#4b5563] mb-0.5">판단 기준</p>
                        <p className="text-xs text-[#9ca3af]">{step.criteria}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#4b5563] mb-0.5">다음 액션</p>
                        <p className="text-xs text-[#9ca3af]">{step.action}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-blue-400/70 mb-0.5">결과 상태</p>
                        <p className="text-xs text-slate-200 font-medium">{step.result}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector */}
                {idx < FLOW_STEPS.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowDown className="h-4 w-4 text-[#2a2e35]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
