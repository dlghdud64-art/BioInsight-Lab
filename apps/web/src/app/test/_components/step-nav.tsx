"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search, GitCompare, FileText, CheckCircle2, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

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

function StepNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromInventory = searchParams?.get("from") === "inventory";

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
    <nav className="w-full bg-white border-b border-gray-300 fixed top-14 left-0 right-0 z-[45] shadow-md" style={{ minHeight: '64px' }}>
      <div className="container mx-auto px-3 md:px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* 재고에서 온 경우 안내 메시지 */}
          {fromInventory && currentStep === 1 && (
            <div className="py-2 flex items-center justify-center gap-2 text-xs text-blue-700 bg-blue-50 border-b border-blue-100">
              <Package className="h-3.5 w-3.5" />
              <span className="font-medium">재고 관리에서 시작된 구매 프로세스입니다</span>
            </div>
          )}
          {/* 모바일: 숫자만 원형 배지 */}
          <div className="flex items-center justify-center gap-2 py-4 md:hidden">
            {steps.map((step, index) => {
              const isActive = step.step === currentStep;
              const isCompleted = step.step < currentStep;
              const isPending = step.step > currentStep;
              const lineCompleted = index + 1 < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold transition-all",
                      isActive &&
                        "bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400/20",
                      isCompleted && "bg-transparent text-slate-400",
                      isPending && "bg-slate-100 text-slate-400"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    ) : (
                      step.step
                    )}
                  </Link>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "h-[2px] w-6 mx-1 transition-colors",
                        lineCompleted ? "bg-blue-500" : "bg-slate-200"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 데스크톱: 동적 스텝바 (완료/활성/대기 + 연결선) */}
          <div className="hidden md:flex items-center justify-center gap-0 py-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.step === currentStep;
              const isCompleted = step.step < currentStep;
              const isPending = step.step > currentStep;
              const lineCompleted = index + 1 < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all relative",
                      isActive &&
                        "bg-blue-600 text-white shadow-md shadow-blue-600/25",
                      isCompleted &&
                        "bg-transparent text-slate-400 hover:text-slate-600 cursor-pointer",
                      isPending && "bg-transparent text-slate-400 cursor-pointer"
                    )}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />
                        <span className="line-through decoration-slate-300">
                          Step {step.step} {step.label}
                        </span>
                      </>
                    ) : isActive ? (
                      <>
                        <span className="font-bold">Step {step.step}</span>
                        <span>{step.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium opacity-70">Step {step.step}</span>
                        <span>{step.label}</span>
                      </>
                    )}
                  </Link>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "h-[2px] w-10 mx-1 transition-colors",
                        lineCompleted ? "bg-blue-500" : "bg-slate-200"
                      )}
                    />
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

export function StepNav() {
  return (
    <Suspense fallback={<StepNavFallback />}>
      <StepNavContent />
    </Suspense>
  );
}

function StepNavFallback() {
  return (
    <nav className="w-full bg-white border-b border-gray-300 fixed top-14 left-0 right-0 z-[45] shadow-md" style={{ minHeight: '64px' }}>
      <div className="container mx-auto px-3 md:px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-[2px] w-6 bg-gray-200" />
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-[2px] w-6 bg-gray-200" />
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    </nav>
  );
}