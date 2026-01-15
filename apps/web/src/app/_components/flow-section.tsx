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

        {/* Steps - 모바일: 슬림 리스트, 데스크탑: 가로 정렬 */}
        <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:gap-4 lg:gap-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === steps.length - 1;
            const colorClasses = {
              indigo: "bg-indigo-50 text-indigo-600",
              emerald: "bg-emerald-50 text-emerald-600",
              blue: "bg-blue-50 text-blue-600",
            };
            
            return (
              <div key={step.href} className="flex flex-col md:flex-row items-center w-full md:w-auto">
                {/* 모바일: 슬림 리스트 형태 */}
                <Link
                  href={step.href}
                  className="group md:hidden flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-full"
                >
                  {/* 좌측: 아이콘 (작게) */}
                  <div className={`flex-shrink-0 p-3 ${colorClasses[step.color as keyof typeof colorClasses]} rounded-lg`}>
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  {/* 우측: 텍스트 */}
                  <div className="text-left flex-1 min-w-0">
                    <h3 className="font-bold text-lg mb-1 text-slate-900">{step.number}. {step.title}</h3>
                    <p className="text-sm text-slate-600 leading-snug break-keep">
                      {step.description}
                    </p>
                  </div>
                </Link>

                {/* 데스크탑: 기존 카드 형태 */}
                <Link
                  href={step.href}
                  className="hidden md:flex group flex-col items-center gap-3 px-6 py-6 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-white border border-gray-200 hover:border-gray-300 w-auto"
                >
                  <div className={`relative w-16 h-16 rounded-xl ${
                    step.color === 'indigo' ? 'bg-indigo-500' :
                    step.color === 'emerald' ? 'bg-emerald-500' :
                    'bg-blue-500'
                  } flex items-center justify-center shadow-md group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 flex-shrink-0`}>
                    <Icon className="h-8 w-8 text-white" strokeWidth={2} />
                    <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${
                      step.color === 'indigo' ? 'bg-indigo-500' :
                      step.color === 'emerald' ? 'bg-emerald-500' :
                      'bg-blue-500'
                    } border-2 border-white flex items-center justify-center text-xs font-bold text-white`}>
                      {step.number}
                    </div>
                  </div>
                  <div className="text-center break-keep">
                    <h3 className="text-base font-semibold text-slate-900 mb-1 whitespace-nowrap">{step.title}</h3>
                    <p className="text-sm text-slate-600 max-w-[140px] mx-auto">
                      {step.description}
                    </p>
                  </div>
                </Link>

                {!isLast && (
                  <>
                    {/* 모바일: 아래쪽 화살표 */}
                    <ArrowRight className="md:hidden h-5 w-5 text-slate-400 my-2 flex-shrink-0 rotate-90" />
                    {/* 데스크탑: 오른쪽 화살표 */}
                    <ArrowRight className="hidden md:block h-6 w-6 text-slate-400 mx-4 flex-shrink-0" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
