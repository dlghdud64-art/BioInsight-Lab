import { Database, Timer, Building2, TrendingDown } from "lucide-react";

const metrics = [
  {
    icon: Database,
    value: "500만+",
    label: "시약 데이터",
  },
  {
    icon: Timer,
    value: "평균 1분",
    label: "견적 산출",
  },
  {
    icon: Building2,
    value: "100+",
    label: "취급 벤더사",
  },
  {
    icon: TrendingDown,
    value: "20% 절감",
    label: "평균 연구비",
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section className="py-5 md:py-6 bg-slate-100/50 border-y border-slate-200">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center justify-center gap-3 py-3 md:py-0 md:px-8"
              >
                <Icon className="h-5 w-5 text-blue-600 shrink-0" />
                <div>
                  <div className="text-base md:text-lg font-bold text-gray-800 leading-tight">
                    {metric.value}
                  </div>
                  <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                    {metric.label}
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
