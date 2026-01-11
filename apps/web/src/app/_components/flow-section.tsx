"use client";

import Link from "next/link";
import { Search, GitCompare, FileText, ArrowRight } from "lucide-react";
import { useState } from "react";

// FlowSection 컴포넌트 - Horizontal Steps (가로 한 줄)
export function FlowSection() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const steps = [
    {
      number: 1,
      title: "검색",
      description: "제품명, 카테고리로 후보 제품을 한 번에 검색합니다.",
      href: "/test/search",
      icon: Search,
      color: "indigo",
      image: "🔍", // 실제로는 이미지 URL로 교체 가능
    },
    {
      number: 2,
      title: "비교",
      description: "가격·스펙 기준으로 후보를 비교해 최종 품목을 고릅니다.",
      href: "/test/compare",
      icon: GitCompare,
      color: "emerald",
      image: "⚖️",
    },
    {
      number: 3,
      title: "견적 요청",
      description: "선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.",
      href: "/test/quote",
      icon: FileText,
      color: "blue",
      image: "📄",
    },
  ];

  const activeStep = steps[hoveredStep !== null ? hoveredStep - 1 : 0];

  return (
    <section id="flow-section" className="py-6 md:py-10 border-b border-slate-200 bg-white scroll-mt-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-2">
            간단한 3단계 프로세스
          </h2>
          <p className="text-xs md:text-sm text-slate-600 max-w-2xl mx-auto">
            검색부터 견적 요청까지, 모든 과정을 한 곳에서 처리하세요
          </p>
        </div>

        {/* Horizontal Steps Bar */}
        <div className="relative">
          <div className="flex items-center justify-center gap-2 md:gap-4 lg:gap-6 mb-6 md:mb-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isLast = idx === steps.length - 1;
              const colorClasses = {
                indigo: "bg-indigo-500 text-indigo-600 border-indigo-500",
                emerald: "bg-emerald-500 text-emerald-600 border-emerald-500",
                blue: "bg-blue-500 text-blue-600 border-blue-500",
              };
              
              return (
                <div key={step.href} className="flex items-center">
                  <Link
                    href={step.href}
                    onMouseEnter={() => setHoveredStep(step.number)}
                    onMouseLeave={() => setHoveredStep(null)}
                    className="group flex flex-col items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-all hover:bg-slate-50"
                  >
                    <div className={`relative w-10 h-10 md:w-12 md:h-12 rounded-lg ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" strokeWidth={2} />
                      <div className={`absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full ${colorClasses[step.color as keyof typeof colorClasses].split(' ')[0]} border-2 border-white flex items-center justify-center text-[10px] font-bold text-white`}>
                        {step.number}
                      </div>
                    </div>
                    <div className="text-center">
                      <h3 className="text-xs md:text-sm font-semibold text-slate-900">{step.title}</h3>
                      <p className="hidden md:block text-[10px] text-slate-600 mt-0.5 max-w-[120px]">
                        {step.description}
                      </p>
                    </div>
                  </Link>
                  {!isLast && (
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-slate-400 mx-1 md:mx-2 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Image Display (hover 시 변경) */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-48 md:h-64 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200 flex items-center justify-center transition-all duration-300">
              <div className="text-center p-6">
                <div className="text-6xl md:text-8xl mb-4">{activeStep.image}</div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">{activeStep.title}</h3>
                <p className="text-sm text-slate-600">{activeStep.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
