import { ArrowLeftRight, Activity, GitCompare, Package } from "lucide-react";

const metrics = [
  {
    icon: ArrowLeftRight,
    value: "End-to-End",
    label: "운영 파이프라인",
    sub: "검색→비교→견적→발주→입고→재고",
  },
  {
    icon: Activity,
    value: "실시간",
    label: "상태 추적",
    sub: "SLA · 병목 · Handoff 가시성",
  },
  {
    icon: GitCompare,
    value: "비교·견적",
    label: "판단 보조",
    sub: "후보 정리 · 조건 해석 · 선택 근거",
  },
  {
    icon: Package,
    value: "입고·재고",
    label: "운영 연결",
    sub: "Lot · 유효기간 · 재주문 연동",
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section
      style={{
        backgroundColor: "#161E28",
        borderTop: "1px solid rgba(120,160,230,0.08)",
        borderBottom: "1px solid rgba(120,160,230,0.08)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[#1E2530]">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="flex items-center justify-center gap-3 py-5 md:py-5 md:px-6">
                <Icon className="h-4 w-4 text-[#7FB2FF] flex-shrink-0" strokeWidth={1.8} />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-[#F3F7FF] leading-none">{metric.value}</span>
                    <span className="text-[11px] font-medium text-[#BAC6D9] leading-none">{metric.label}</span>
                  </div>
                  <div className="text-[10px] text-[#667389] font-medium mt-0.5 whitespace-nowrap">{metric.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
