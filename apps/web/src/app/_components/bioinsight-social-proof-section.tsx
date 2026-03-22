import { ArrowLeftRight, Activity, Building2, Clock } from "lucide-react";

const metrics = [
  {
    icon: ArrowLeftRight,
    value: "End-to-End",
    label: "운영 파이프라인",
    sub: "비교→견적→발주→입고→재고",
  },
  {
    icon: Activity,
    value: "실시간",
    label: "상태 추적",
    sub: "SLA · Owner · Handoff 가시성",
  },
  {
    icon: Building2,
    value: "100+",
    label: "글로벌 벤더",
    sub: "Sigma · Gibco · TCI 외",
  },
  {
    icon: Clock,
    value: "50%",
    label: "사이클 단축",
    sub: "반복 구매 프로세스 자동화",
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section className="py-0 bg-el border-b border-bd">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-bd/60">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center justify-center gap-3 py-4 md:py-4 md:px-6"
              >
                <Icon className="h-5 w-5 text-blue-400 flex-shrink-0" strokeWidth={1.8} />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base md:text-lg font-bold text-slate-100 leading-none">
                      {metric.value}
                    </span>
                    <span className="text-xs font-medium text-slate-300 leading-none">
                      {metric.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                    {metric.sub}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
