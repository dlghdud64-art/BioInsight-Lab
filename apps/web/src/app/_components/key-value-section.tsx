import { Card, CardContent } from "@/components/ui/card";
import { Search, FileSpreadsheet, Users } from "lucide-react";

// KeyValueSection 컴포넌트 - 업무툴 스타일
export function KeyValueSection() {
  const values = [
    {
      title: "통합 검색",
      description: "여러 벤더 제품을 한 번에 검색. 자동 추출로 후보를 빠르게 모읍니다.",
      icon: Search,
      color: "indigo",
      bgGradient: "from-indigo-50 to-indigo-100/50",
      iconBg: "bg-indigo-500",
      borderColor: "border-indigo-200",
      hoverBorder: "hover:border-indigo-400",
      hoverBg: "hover:bg-indigo-50/50",
    },
    {
      title: "견적 요청 리스트 자동 정리",
      description: "후보 비교 후 리스트로 정리. 회신 가격·납기도 같은 리스트에서 비교합니다.",
      icon: FileSpreadsheet,
      color: "emerald",
      bgGradient: "from-emerald-50 to-emerald-100/50",
      iconBg: "bg-emerald-500",
      borderColor: "border-emerald-200",
      hoverBorder: "hover:border-emerald-400",
      hoverBg: "hover:bg-emerald-50/50",
    },
    {
      title: "팀 협업",
      description: "연구–QC–구매가 하나의 리스트로 협업. 버전 분산 문제를 줄입니다.",
      icon: Users,
      color: "blue",
      bgGradient: "from-blue-50 to-blue-100/50",
      iconBg: "bg-blue-500",
      borderColor: "border-blue-200",
      hoverBorder: "hover:border-blue-400",
      hoverBg: "hover:bg-blue-50/50",
    },
  ];

  return (
    <section id="features" className="py-8 md:py-12 lg:py-16 border-b border-bd bg-gradient-to-b from-white to-slate-50/30 scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12 lg:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-100 mb-2 md:mb-4">
            구매 준비 도구
          </h2>
          <p className="text-sm md:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            검색 사이트가 아니라, 구매 준비/정리 도구입니다
          </p>
        </div>
        <div className="grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-3">
          {values.map((value, idx) => {
            const Icon = value.icon;
            return (
              <Card
                key={idx}
                className="border border-gray-100 bg-pn rounded-2xl shadow-sm transition-all hover:shadow-md"
              >
                <CardContent className="flex flex-row md:flex-col items-start md:items-center text-left md:text-center p-5 md:p-8 gap-4">
                  <div className="shrink-0 p-3 md:p-4 rounded-xl bg-blue-50/50">
                    <Icon className="w-7 h-7 md:w-12 md:h-12 text-blue-600" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-xl font-bold text-slate-100">
                      {value.title}
                    </h3>
                    <p className="text-sm md:text-base mt-1 text-gray-500 leading-snug break-keep">
                      {value.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
