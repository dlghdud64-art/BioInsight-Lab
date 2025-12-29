import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Search, GitCompare, FileText, ArrowRight } from "lucide-react";

// FlowSection 컴포넌트 - 업무툴 스타일
export function FlowSection() {
  const steps = [
    {
      number: 1,
      title: "검색",
      description: "제품명, 카테고리로 후보 제품을 한 번에 검색합니다.",
      href: "/test/search",
      icon: Search,
      color: "indigo",
    },
    {
      number: 2,
      title: "비교",
      description: "가격·스펙 기준으로 후보를 비교해 최종 품목을 고릅니다.",
      href: "/test/compare",
      icon: GitCompare,
      color: "emerald",
    },
    {
      number: 3,
      title: "견적 요청",
      description: "선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.",
      href: "/test/quote",
      icon: FileText,
      color: "blue",
    },
  ];

  return (
    <section id="flow-section" className="py-8 md:py-12 lg:py-16 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12 lg:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-2 md:mb-4">
            간단한 3단계 프로세스
          </h2>
          <p className="text-sm md:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            검색부터 견적 요청까지, 모든 과정을 한 곳에서 처리하세요
          </p>
        </div>
        <div className="grid gap-4 md:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-3 w-full">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const colorClasses = {
              indigo: "bg-indigo-500 border-indigo-500 text-indigo-600",
              emerald: "bg-emerald-500 border-emerald-500 text-emerald-600",
              blue: "bg-blue-500 border-blue-500 text-blue-600",
            };
            const hoverClasses = {
              indigo: "hover:border-indigo-400 hover:bg-indigo-50/50",
              emerald: "hover:border-emerald-400 hover:bg-emerald-50/50",
              blue: "hover:border-blue-400 hover:bg-blue-50/50",
            };
            
            return (
              <Link key={step.href} href={step.href} className="relative z-10">
                <Card className={`h-full border-2 border-slate-200 bg-white rounded-xl ${hoverClasses[step.color as keyof typeof hoverClasses]} transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 group`}>
                  <CardContent className="flex flex-col items-center text-center p-4 md:p-6 lg:p-8 h-full">
                    <div className={`relative mb-3 md:mb-4 w-14 h-14 md:w-16 md:h-16 rounded-2xl ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 md:h-7 md:w-7 text-white" strokeWidth={2} />
                      <div className={`absolute -top-2 -right-2 w-6 h-6 md:w-7 md:h-7 rounded-full ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} border-2 border-white flex items-center justify-center text-xs font-bold text-white`}>
                        {step.number}
                      </div>
                    </div>
                    <div className="space-y-2 md:space-y-3 flex-1">
                      <h3 className="text-lg md:text-xl font-bold text-slate-900">{step.title}</h3>
                      <p className="text-sm md:text-base leading-relaxed text-slate-700">
                        {step.description}
                      </p>
                    </div>
                    <div className="mt-4 md:mt-6 flex items-center gap-2 text-sm md:text-base font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                      시작하기
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
