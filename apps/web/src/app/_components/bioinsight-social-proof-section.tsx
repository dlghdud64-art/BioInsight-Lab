import { Database, Timer, Building2, TrendingDown } from "lucide-react";

const metrics = [
  {
    icon: Database,
    value: "500만+",
    label: "시약 데이터",
    sub: "글로벌 카탈로그 DB",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Timer,
    value: "평균 1분",
    label: "견적 산출",
    sub: "검색부터 견적서까지",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Building2,
    value: "100+",
    label: "취급 벤더사",
    sub: "Sigma · Gibco · TCI 외",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    icon: TrendingDown,
    value: "20% 절감",
    label: "평균 연구비",
    sub: "구매 비용 최적화 기준",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section className="py-0 bg-white border-y border-slate-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center justify-center gap-3.5 py-5 md:py-5 md:px-8"
              >
                {/* 아이콘 컨테이너 */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${metric.iconBg}`}>
                  <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                </div>

                {/* 텍스트 */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg md:text-xl font-extrabold text-gray-900 leading-none">
                      {metric.value}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 leading-none">
                      {metric.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-1 whitespace-nowrap">
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
