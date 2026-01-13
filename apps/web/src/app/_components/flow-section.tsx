"use client";

import Link from "next/link";
import { Search, GitCompare, FileText, ArrowRight } from "lucide-react";

// FlowSection 컴포넌트 - Horizontal Steps (가로 한 줄)
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
    <section id="flow-section" className="py-12 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-2">
            간단한 3단계 프로세스
          </h2>
          <p className="text-xs md:text-sm text-slate-600 max-w-2xl mx-auto">
            검색부터 견적 요청까지, 모든 과정을 한 곳에서 처리하세요
          </p>
        </div>

        {/* Steps - 모바일: 세로 정렬, 데스크탑: 가로 정렬 */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-4 lg:gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            const colorClasses = {
              indigo: "bg-indigo-500 text-indigo-600 border-indigo-500",
              emerald: "bg-emerald-500 text-emerald-600 border-emerald-500",
              blue: "bg-blue-500 text-blue-600 border-blue-500",
            };
            
            return (
              <div key={step.href} className="flex flex-col md:flex-row items-center w-full md:w-auto">
                <Link
                  href={step.href}
                  className="group flex flex-col items-center gap-3 px-4 md:px-6 py-4 md:py-6 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-white border border-gray-200 hover:border-gray-300 w-full md:w-auto"
                >
                  <div className={`relative w-12 h-12 md:w-16 md:h-16 rounded-xl ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                    <Icon className="h-6 w-6 md:h-8 md:w-8 text-white" strokeWidth={2} />
                    <div className={`absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} border-2 border-white flex items-center justify-center text-xs font-bold text-white`}>
                      {step.number}
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-xs md:text-sm text-slate-600 max-w-[200px] md:max-w-[140px]">
                      {step.description}
                    </p>
                  </div>
                </Link>
                {!isLast && (
                  <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-slate-400 my-2 md:my-0 md:mx-4 flex-shrink-0 rotate-90 md:rotate-0 transition-transform" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
