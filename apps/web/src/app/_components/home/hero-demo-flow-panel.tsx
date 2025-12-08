"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type HeroStepId = "search" | "compare" | "groupware";

const HERO_STEPS: {
  id: HeroStepId;
  badge: string;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    id: "search",
    badge: "Step 1",
    label: "검색",
    title: "검색으로 후보를 한 번에 모으기",
    description:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다. GPT가 검색어를 이해해 유사 제품 후보를 자동으로 정리해 줍니다.",
  },
  {
    id: "compare",
    badge: "Step 2",
    label: "비교",
    title: "필요한 제품만 골라서 비교 · 리스트 만들기",
    description:
      "선택한 제품들의 벤더, 단가, 규격을 한 화면에서 비교하고, 수량·비고를 입력해 실제 구매에 쓸 품목 리스트를 완성합니다.",
  },
  {
    id: "groupware",
    badge: "Step 3",
    label: "그룹웨어 붙여넣기",
    title: "그룹웨어 결재 양식에 붙여넣기",
    description:
      "완성된 품목 리스트를 TSV/텍스트로 복사해 전자결재·그룹웨어 양식에 그대로 붙여넣습니다. 향후에는 직접 견적 요청/구매까지 확장 예정입니다.",
  },
];

export function HeroDemoFlowPanel() {
  const [active, setActive] = useState<HeroStepId>("search");
  const current = HERO_STEPS.find((s) => s.id === active)!;

  const scrollToDemo = () => {
    const el = document.getElementById("demo-flow-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-slate-500">데모 플로우</p>

      {/* Step 토글 버튼들 */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        {HERO_STEPS.map((step) => {
          const selected = step.id === active;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActive(step.id)}
              className={cn(
                "flex h-[56px] min-w-0 flex-shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80 whitespace-nowrap leading-none">
                {step.badge}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-tight whitespace-nowrap">
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 선택된 Step의 요약 설명 (미니 데모 뷰) */}
      <div className="h-[72px] rounded-xl bg-slate-50 px-3 py-2">
        <p className="mb-0.5 text-xs font-semibold leading-tight text-slate-900 line-clamp-2">
          {current.title}
        </p>
        <p className="text-[11px] leading-tight text-slate-500 line-clamp-3">
          {current.description}
        </p>
      </div>

      {/* 아래 상세 데모 섹션으로 스크롤 */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={scrollToDemo}
        >
          3단계 플로우 자세히 보기
        </Button>
      </div>
    </aside>
  );
}


import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type HeroStepId = "search" | "compare" | "groupware";

const HERO_STEPS: {
  id: HeroStepId;
  badge: string;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    id: "search",
    badge: "Step 1",
    label: "검색",
    title: "검색으로 후보를 한 번에 모으기",
    description:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다. GPT가 검색어를 이해해 유사 제품 후보를 자동으로 정리해 줍니다.",
  },
  {
    id: "compare",
    badge: "Step 2",
    label: "비교",
    title: "필요한 제품만 골라서 비교 · 리스트 만들기",
    description:
      "선택한 제품들의 벤더, 단가, 규격을 한 화면에서 비교하고, 수량·비고를 입력해 실제 구매에 쓸 품목 리스트를 완성합니다.",
  },
  {
    id: "groupware",
    badge: "Step 3",
    label: "그룹웨어 붙여넣기",
    title: "그룹웨어 결재 양식에 붙여넣기",
    description:
      "완성된 품목 리스트를 TSV/텍스트로 복사해 전자결재·그룹웨어 양식에 그대로 붙여넣습니다. 향후에는 직접 견적 요청/구매까지 확장 예정입니다.",
  },
];

export function HeroDemoFlowPanel() {
  const [active, setActive] = useState<HeroStepId>("search");
  const current = HERO_STEPS.find((s) => s.id === active)!;

  const scrollToDemo = () => {
    const el = document.getElementById("demo-flow-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-slate-500">데모 플로우</p>

      {/* Step 토글 버튼들 */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        {HERO_STEPS.map((step) => {
          const selected = step.id === active;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActive(step.id)}
              className={cn(
                "flex h-[56px] min-w-0 flex-shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80 whitespace-nowrap leading-none">
                {step.badge}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-tight whitespace-nowrap">
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 선택된 Step의 요약 설명 (미니 데모 뷰) */}
      <div className="h-[72px] rounded-xl bg-slate-50 px-3 py-2">
        <p className="mb-0.5 text-xs font-semibold leading-tight text-slate-900 line-clamp-2">
          {current.title}
        </p>
        <p className="text-[11px] leading-tight text-slate-500 line-clamp-3">
          {current.description}
        </p>
      </div>

      {/* 아래 상세 데모 섹션으로 스크롤 */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={scrollToDemo}
        >
          3단계 플로우 자세히 보기
        </Button>
      </div>
    </aside>
  );
}


import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type HeroStepId = "search" | "compare" | "groupware";

const HERO_STEPS: {
  id: HeroStepId;
  badge: string;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    id: "search",
    badge: "Step 1",
    label: "검색",
    title: "검색으로 후보를 한 번에 모으기",
    description:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다. GPT가 검색어를 이해해 유사 제품 후보를 자동으로 정리해 줍니다.",
  },
  {
    id: "compare",
    badge: "Step 2",
    label: "비교",
    title: "필요한 제품만 골라서 비교 · 리스트 만들기",
    description:
      "선택한 제품들의 벤더, 단가, 규격을 한 화면에서 비교하고, 수량·비고를 입력해 실제 구매에 쓸 품목 리스트를 완성합니다.",
  },
  {
    id: "groupware",
    badge: "Step 3",
    label: "그룹웨어 붙여넣기",
    title: "그룹웨어 결재 양식에 붙여넣기",
    description:
      "완성된 품목 리스트를 TSV/텍스트로 복사해 전자결재·그룹웨어 양식에 그대로 붙여넣습니다. 향후에는 직접 견적 요청/구매까지 확장 예정입니다.",
  },
];

export function HeroDemoFlowPanel() {
  const [active, setActive] = useState<HeroStepId>("search");
  const current = HERO_STEPS.find((s) => s.id === active)!;

  const scrollToDemo = () => {
    const el = document.getElementById("demo-flow-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-slate-500">데모 플로우</p>

      {/* Step 토글 버튼들 */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        {HERO_STEPS.map((step) => {
          const selected = step.id === active;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActive(step.id)}
              className={cn(
                "flex h-[56px] min-w-0 flex-shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80 whitespace-nowrap leading-none">
                {step.badge}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-tight whitespace-nowrap">
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 선택된 Step의 요약 설명 (미니 데모 뷰) */}
      <div className="h-[72px] rounded-xl bg-slate-50 px-3 py-2">
        <p className="mb-0.5 text-xs font-semibold leading-tight text-slate-900 line-clamp-2">
          {current.title}
        </p>
        <p className="text-[11px] leading-tight text-slate-500 line-clamp-3">
          {current.description}
        </p>
      </div>

      {/* 아래 상세 데모 섹션으로 스크롤 */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
          onClick={scrollToDemo}
        >
          3단계 플로우 자세히 보기
        </Button>
      </div>
    </aside>
  );
}

