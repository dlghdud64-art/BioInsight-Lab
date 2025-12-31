"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, GitCompare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "search",
    label: "검색/AI 분석",
    href: "/search",
    icon: Search,
    step: 1,
    match: /^\/search(\/.*)?$/,
  },
  {
    id: "compare",
    label: "제품 비교",
    href: "/compare",
    icon: GitCompare,
    step: 2,
    match: /^\/compare(\/.*)?$/,
  },
  {
    id: "quote",
    label: "견적 요청",
    href: "/quotes",
    icon: FileText,
    step: 3,
    match: /^\/quotes(\/.*)?$/,
  },
];

export function SearchStepNav() {
  const pathname = usePathname();
  
  const getCurrentStep = () => {
    for (const step of steps) {
      if (step.match && step.match.test(pathname)) {
        return step.step;
      } else if (pathname === step.href || pathname.startsWith(step.href + "/")) {
        return step.step;
      }
    }
    return 1;
  };
  
  const currentStep = getCurrentStep();

  return (
    <nav className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-14 z-40">
      <div className="container mx-auto px-3 md:px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* 모바일: 숫자만 원형 배지 */}
          <div className="flex items-center justify-center gap-2 py-3 md:hidden">
            {steps.map((step, index) => {
              const isActive = step.step === currentStep;
              const isCompleted = step.step < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all",
                      isActive
                        ? "bg-blue-600 text-white shadow-md scale-110"
                        : isCompleted
                        ? "bg-gray-200 text-gray-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {step.step}
                  </Link>
                  {index < steps.length - 1 && (
                    <div className="h-0.5 w-4 bg-gray-200 mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* 데스크톱: Glassmorphism 스타일 탭 */}
          <div className="hidden md:flex items-center gap-0 py-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.step === currentStep;
              const isCompleted = step.step < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-blue-600 text-white shadow-md"
                        : isCompleted
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer"
                        : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-white" : "")} />
                    <span>{step.label}</span>
                  </Link>
                  {index < steps.length - 1 && (
                    <div className="h-0.5 w-8 bg-gray-200 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

