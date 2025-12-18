"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, GitCompare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "search",
    label: "검색/AI 분석",
    fullLabel: "검색/AI 분석",
    href: "/test/search",
    icon: Search,
    step: 1,
    match: /^\/test\/search(\/.*)?$/,
  },
  {
    id: "compare",
    label: "제품 비교",
    fullLabel: "제품 비교",
    href: "/test/compare",
    icon: GitCompare,
    step: 2,
    match: /^\/test\/compare(\/.*)?$/,
  },
  {
    id: "quote",
    label: "견적 요청",
    fullLabel: "견적 요청",
    href: "/test/quote",
    icon: FileText,
    step: 3,
    match: /^\/test\/quote(\/.*)?$/,
  },
];

export function StepNav() {
  const pathname = usePathname();
  // 현재 경로가 어떤 step에 해당하는지 확인 (하위 경로 포함)
  const getCurrentStep = () => {
    for (const step of steps) {
      if (step.match) {
        if (step.match.test(pathname)) {
          return step.step;
        }
      } else if (pathname === step.href || pathname.startsWith(step.href + "/")) {
        return step.step;
      }
    }
    return 1;
  };
  const currentStep = getCurrentStep();

  return (
    <nav className="w-full md:w-auto">
      {/* 모바일: Step + Label 형태 */}
      <div className="grid grid-cols-3 gap-1.5 md:hidden">
        {steps.map((step) => {
          const isActive = step.match
            ? step.match.test(pathname)
            : pathname === step.href || pathname.startsWith(step.href + "/");
          
          // 모바일용 짧은 라벨
          const mobileLabel = step.id === "search" ? "검색/AI" : step.id === "compare" ? "제품 비교" : step.label;
          
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-full px-1.5 py-2 text-xs transition-colors min-h-[60px]",
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <span className="text-[10px] opacity-80 mb-0.5">Step {step.step}</span>
              <span className="font-medium text-[9px] leading-tight text-center px-0.5 break-words">{mobileLabel}</span>
            </Link>
          );
        })}
      </div>

      {/* 데스크톱: 기존 형태 */}
      <div className="hidden md:flex items-center gap-2 border-b border-slate-200 pb-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.match
            ? step.match.test(pathname)
            : pathname === step.href || pathname.startsWith(step.href + "/");
          const isCompleted = step.step < currentStep;
          const isCurrent = step.step === currentStep;

          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : isCompleted
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold",
                  isActive
                    ? "bg-white text-slate-900"
                    : isCompleted
                    ? "bg-slate-200 text-slate-700"
                    : "bg-slate-200 text-slate-400"
                )}
              >
                {step.step}
              </div>
              <Icon className="h-4 w-4" />
              <span>{step.fullLabel}</span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "ml-2 h-0.5 w-8",
                    isCompleted ? "bg-slate-300" : "bg-slate-200"
                  )}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}