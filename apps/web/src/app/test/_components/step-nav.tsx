"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, GitCompare, FileText, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "search",
    label: "검색",
    fullLabel: "검색/AI 분석",
    href: "/test/search",
    icon: Search,
    step: 1,
    match: /^\/test\/search(\/.*)?$/,
  },
  {
    id: "compare",
    label: "비교",
    fullLabel: "제품 비교",
    href: "/test/compare",
    icon: GitCompare,
    step: 2,
    match: /^\/test\/compare(\/.*)?$/,
  },
  {
    id: "quote",
    label: "품목 리스트",
    fullLabel: "품목 리스트",
    href: "/test/quote",
    icon: FileText,
    step: 3,
    match: /^\/test\/quote(\/.*)?$/,
  },
  {
    id: "protocol",
    label: "프로토콜 분석",
    fullLabel: "프로토콜 분석",
    href: "/protocol/bom",
    icon: FlaskConical,
    step: 4,
    match: /^\/protocol\/bom(\/.*)?$/,
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
      <div className="grid grid-cols-4 gap-2 md:hidden">
        {steps.map((step) => {
          const isActive = step.match
            ? step.match.test(pathname)
            : pathname === step.href || pathname.startsWith(step.href + "/");
          
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "flex flex-col items-center justify-center rounded-full px-2 py-2 text-xs transition-colors",
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              <span className="text-[11px] opacity-80">Step {step.step}</span>
              <span className="mt-0.5 font-medium text-[10px] leading-tight text-center">{step.label}</span>
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