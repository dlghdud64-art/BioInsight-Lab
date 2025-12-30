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
    <section id="features" className="py-8 md:py-12 lg:py-16 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/30 scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12 lg:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-2 md:mb-4">
            구매 준비 도구
          </h2>
          <p className="text-sm md:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            검색 사이트가 아니라, 구매 준비/정리 도구입니다
          </p>
        </div>
        <div className="grid gap-2 md:gap-6 grid-cols-3 md:grid-cols-3">
          {values.map((value, idx) => {
            const Icon = value.icon;
            return (
              <Card 
                key={idx} 
                className={`border-2 ${value.borderColor} bg-gradient-to-br ${value.bgGradient} ${value.hoverBorder} ${value.hoverBg} transition-all hover:shadow-lg hover:-translate-y-1 rounded-lg md:rounded-xl group`}
              >
                <CardContent className="flex flex-col items-center text-center gap-2 md:flex-row md:items-start md:text-left md:gap-3 md:gap-4 p-2 md:p-6">
                  <div className={`${value.iconBg} p-2 md:p-3 rounded-lg md:rounded-xl flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4 md:h-6 md:w-6 text-white" strokeWidth={2} />
                  </div>
                  <div className="space-y-1 md:space-y-2 min-w-0 flex-1">
                    <h3 className="text-[10px] md:text-lg font-bold text-slate-900 leading-tight">
                      {value.title}
                    </h3>
                    <p className="hidden md:block text-base leading-relaxed text-slate-700">
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
