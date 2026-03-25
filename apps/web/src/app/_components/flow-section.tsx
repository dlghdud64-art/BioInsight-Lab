"use client";

import Link from "next/link";
import { Search, GitCompare, FileText, ArrowRight } from "lucide-react";

// FlowSection 컴포넌트 - Horizontal Steps (가로 한 줄)
export function FlowSection() {
  const steps = [
    {
      number: 1,
      title: "검색",
      description: "제품명, CAS No., 제조사 또는 실험 목적으로 검색하고 대체 후보까지 함께 확인하세요.",
      href: "/search",
      icon: Search,
      color: "indigo",
    },
    {
      number: 2,
      title: "비교",
      description: "여러 벤더의 가격, 납기, 스펙을 한 화면에서 나란히 보고 최적 후보를 선택하세요.",
      href: "/test/compare",
      icon: GitCompare,
      color: "emerald",
    },
    {
      number: 3,
      title: "견적 요청",
      description: "선택 품목을 담아 견적 요청 리스트를 만들고 공유 링크로 바로 전달하세요.",
      href: "/test/quote",
      icon: FileText,
      color: "blue",
    },
  ];

  return (
    <section id="flow-section" className="py-10 md:py-20 border-b border-[#2a2a2e] bg-[#1a1a1e] scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-6 md:mb-14">
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 mb-1 md:mb-2">
            검색에서 견적까지, 3단계로
          </h2>
          <p className="text-xs md:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            검색하고, 비교하고, 견적을 요청하면 끝입니다.
          </p>
        </div>

        {/* Steps - 모바일: 슬림 리스트, 데스크탑: 가로 정렬 */}
        <div className="flex flex-col md:flex-row items-center justify-center space-y-1.5 md:space-y-0 md:gap-4 lg:gap-6">
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
                {/* 모바일: 압축형 리스트 */}
                <Link
                  href={step.href}
                  className="group md:hidden flex items-center gap-3 px-3.5 py-2.5 bg-[#1a1a1e] rounded-lg border border-gray-100 hover:bg-[#222226] transition-colors w-full"
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[step.color as keyof typeof colorClasses]}`}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-slate-100">{step.number}. {step.title}</h3>
                    <p className="text-xs text-slate-500 leading-tight line-clamp-1">
                      {step.description}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                </Link>

                {/* 데스크탑: 카드 형태 */}
                <Link
                  href={step.href}
                  className="hidden md:flex group flex-col items-center gap-4 px-8 py-8 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg bg-[#1a1a1e] border border-[#2a2a2e] hover:border-gray-300 w-auto"
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
                    <h3 className="text-base font-semibold text-slate-100 mb-1.5 whitespace-nowrap">{step.title}</h3>
                    <p className="text-xs text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </Link>

                {!isLast && (
                  <ArrowRight className="hidden md:block h-5 w-5 text-slate-300 mx-3 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
