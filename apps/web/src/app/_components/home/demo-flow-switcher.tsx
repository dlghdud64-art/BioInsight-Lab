"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ListChecks, ClipboardList } from "lucide-react";

type StepId = "search" | "compare" | "groupware";

const STEPS: {
  id: StepId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: string;
}[] = [
  {
    id: "search",
    label: "검색",
    badge: "Step 1",
    title: "검색으로 후보를 한 번에 모으기",
    subtitle:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다.",
    bullets: [
      "GPT가 검색어를 이해해서 유사 제품을 자동으로 정리",
      "벤더 / 카테고리 / Grade로 필터링",
      "선택한 제품을 바로 품목 리스트에 담기",
    ],
    cta: "검색 화면 열기",
  },
  {
    id: "compare",
    label: "비교",
    badge: "Step 2",
    title: "필요한 제품만 골라서 비교 · 품목 리스트 만들기",
    subtitle: "실제 구매 후보만 장바구니처럼 모아 정리합니다.",
    bullets: [
      "벤더 / 단가 / 규격을 한 화면에서 비교",
      "수량, 비고를 입력하면 품목 리스트 자동 정리",
      "견적 요청에 바로 쓸 수 있는 형태로 저장",
    ],
    cta: "품목 리스트 보러 가기",
  },
  {
    id: "groupware",
    label: "그룹웨어에 붙여넣기",
    badge: "Step 3",
    title: "그룹웨어 결재 양식에 붙여넣기",
    subtitle:
      "회사에서 쓰는 전자결재/그룹웨어 프로세스를 그대로 사용합니다.",
    bullets: [
      "완성된 품목 리스트를 TSV/텍스트로 복사",
      "구매 요청 양식에 그대로 붙여넣기",
      "향후에는 직접 견적 요청/구매까지 확장 예정",
    ],
    cta: "견적 요청 화면 열기",
  },
];

export function DemoFlowSwitcherSection() {
  const [active, setActive] = useState<StepId>("search");
  const current = STEPS.find((s) => s.id === active)!;

  return (
    <section
      id="demo-flow-section"
      className="border-y border-slate-100 bg-slate-50/60 py-10"
    >
      {/* ✅ 여기서부터 전체를 가운데로 모은다 */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        {/* 섹션 헤더 */}
        <header className="text-center space-y-1">
          <p className="text-xs font-medium text-slate-500">
            3단계 데모 플로우
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            검색 → 비교 → 그룹웨어까지 실제 사용 흐름을 간단히 체험해 보세요.
          </h2>
        </header>

        {/* 토글 + 카드: 전체 폭을 더 줄이고 가운데 정렬 */}
        <div className="w-full max-w-xl space-y-4">
          {/* 토글 버튼 그룹 */}
          <div className="inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-1 text-xs shadow-sm">
            {STEPS.map((step) => {
              const selected = step.id === active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActive(step.id)}
                  onMouseEnter={() => setActive(step.id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1 transition",
                    selected
                      ? "bg-slate-900 text-slate-50"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {step.badge}
                  </span>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* 선택된 단계 카드 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {active === "search" && <Search className="h-4 w-4" />}
                {active === "compare" && <ListChecks className="h-4 w-4" />}
                {active === "groupware" && (
                  <ClipboardList className="h-4 w-4" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {current.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">
                  {current.subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-5">
              <ul className="space-y-1.5 text-xs text-slate-600">
                {current.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {current.cta && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-1 text-xs"
                    onClick={() => {
                      if (current.id === "search") {
                        window.location.href = "/test/search";
                      } else if (current.id === "compare") {
                        window.location.href = "/test/quote";
                      } else {
                        window.location.href = "/test/quote/request";
                      }
                    }}
                  >
                    {current.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ListChecks, ClipboardList } from "lucide-react";

type StepId = "search" | "compare" | "groupware";

const STEPS: {
  id: StepId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: string;
}[] = [
  {
    id: "search",
    label: "검색",
    badge: "Step 1",
    title: "검색으로 후보를 한 번에 모으기",
    subtitle:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다.",
    bullets: [
      "GPT가 검색어를 이해해서 유사 제품을 자동으로 정리",
      "벤더 / 카테고리 / Grade로 필터링",
      "선택한 제품을 바로 품목 리스트에 담기",
    ],
    cta: "검색 화면 열기",
  },
  {
    id: "compare",
    label: "비교",
    badge: "Step 2",
    title: "필요한 제품만 골라서 비교 · 품목 리스트 만들기",
    subtitle: "실제 구매 후보만 장바구니처럼 모아 정리합니다.",
    bullets: [
      "벤더 / 단가 / 규격을 한 화면에서 비교",
      "수량, 비고를 입력하면 품목 리스트 자동 정리",
      "견적 요청에 바로 쓸 수 있는 형태로 저장",
    ],
    cta: "품목 리스트 보러 가기",
  },
  {
    id: "groupware",
    label: "그룹웨어에 붙여넣기",
    badge: "Step 3",
    title: "그룹웨어 결재 양식에 붙여넣기",
    subtitle:
      "회사에서 쓰는 전자결재/그룹웨어 프로세스를 그대로 사용합니다.",
    bullets: [
      "완성된 품목 리스트를 TSV/텍스트로 복사",
      "구매 요청 양식에 그대로 붙여넣기",
      "향후에는 직접 견적 요청/구매까지 확장 예정",
    ],
    cta: "견적 요청 화면 열기",
  },
];

export function DemoFlowSwitcherSection() {
  const [active, setActive] = useState<StepId>("search");
  const current = STEPS.find((s) => s.id === active)!;

  return (
    <section
      id="demo-flow-section"
      className="border-y border-slate-100 bg-slate-50/60 py-10"
    >
      {/* ✅ 여기서부터 전체를 가운데로 모은다 */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        {/* 섹션 헤더 */}
        <header className="text-center space-y-1">
          <p className="text-xs font-medium text-slate-500">
            3단계 데모 플로우
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            검색 → 비교 → 그룹웨어까지 실제 사용 흐름을 간단히 체험해 보세요.
          </h2>
        </header>

        {/* 토글 + 카드: 전체 폭을 더 줄이고 가운데 정렬 */}
        <div className="w-full max-w-xl space-y-4">
          {/* 토글 버튼 그룹 */}
          <div className="inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-1 text-xs shadow-sm">
            {STEPS.map((step) => {
              const selected = step.id === active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActive(step.id)}
                  onMouseEnter={() => setActive(step.id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1 transition",
                    selected
                      ? "bg-slate-900 text-slate-50"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {step.badge}
                  </span>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* 선택된 단계 카드 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {active === "search" && <Search className="h-4 w-4" />}
                {active === "compare" && <ListChecks className="h-4 w-4" />}
                {active === "groupware" && (
                  <ClipboardList className="h-4 w-4" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {current.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">
                  {current.subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-5">
              <ul className="space-y-1.5 text-xs text-slate-600">
                {current.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {current.cta && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-1 text-xs"
                    onClick={() => {
                      if (current.id === "search") {
                        window.location.href = "/test/search";
                      } else if (current.id === "compare") {
                        window.location.href = "/test/quote";
                      } else {
                        window.location.href = "/test/quote/request";
                      }
                    }}
                  >
                    {current.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, ListChecks, ClipboardList } from "lucide-react";

type StepId = "search" | "compare" | "groupware";

const STEPS: {
  id: StepId;
  label: string;
  badge: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: string;
}[] = [
  {
    id: "search",
    label: "검색",
    badge: "Step 1",
    title: "검색으로 후보를 한 번에 모으기",
    subtitle:
      "제품명, 타깃, 카테고리로 여러 벤더 제품을 한 번에 조회합니다.",
    bullets: [
      "GPT가 검색어를 이해해서 유사 제품을 자동으로 정리",
      "벤더 / 카테고리 / Grade로 필터링",
      "선택한 제품을 바로 품목 리스트에 담기",
    ],
    cta: "검색 화면 열기",
  },
  {
    id: "compare",
    label: "비교",
    badge: "Step 2",
    title: "필요한 제품만 골라서 비교 · 품목 리스트 만들기",
    subtitle: "실제 구매 후보만 장바구니처럼 모아 정리합니다.",
    bullets: [
      "벤더 / 단가 / 규격을 한 화면에서 비교",
      "수량, 비고를 입력하면 품목 리스트 자동 정리",
      "견적 요청에 바로 쓸 수 있는 형태로 저장",
    ],
    cta: "품목 리스트 보러 가기",
  },
  {
    id: "groupware",
    label: "그룹웨어에 붙여넣기",
    badge: "Step 3",
    title: "그룹웨어 결재 양식에 붙여넣기",
    subtitle:
      "회사에서 쓰는 전자결재/그룹웨어 프로세스를 그대로 사용합니다.",
    bullets: [
      "완성된 품목 리스트를 TSV/텍스트로 복사",
      "구매 요청 양식에 그대로 붙여넣기",
      "향후에는 직접 견적 요청/구매까지 확장 예정",
    ],
    cta: "견적 요청 화면 열기",
  },
];

export function DemoFlowSwitcherSection() {
  const [active, setActive] = useState<StepId>("search");
  const current = STEPS.find((s) => s.id === active)!;

  return (
    <section
      id="demo-flow-section"
      className="border-y border-slate-100 bg-slate-50/60 py-10"
    >
      {/* ✅ 여기서부터 전체를 가운데로 모은다 */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        {/* 섹션 헤더 */}
        <header className="text-center space-y-1">
          <p className="text-xs font-medium text-slate-500">
            3단계 데모 플로우
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            검색 → 비교 → 그룹웨어까지 실제 사용 흐름을 간단히 체험해 보세요.
          </h2>
        </header>

        {/* 토글 + 카드: 전체 폭을 더 줄이고 가운데 정렬 */}
        <div className="w-full max-w-xl space-y-4">
          {/* 토글 버튼 그룹 */}
          <div className="inline-flex w-full rounded-full border border-slate-200 bg-white/80 p-1 text-xs shadow-sm">
            {STEPS.map((step) => {
              const selected = step.id === active;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActive(step.id)}
                  onMouseEnter={() => setActive(step.id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-1.5 inline-flex items-center justify-center gap-1 transition",
                    selected
                      ? "bg-slate-900 text-slate-50"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {step.badge}
                  </span>
                  <span className="text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* 선택된 단계 카드 */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {active === "search" && <Search className="h-4 w-4" />}
                {active === "compare" && <ListChecks className="h-4 w-4" />}
                {active === "groupware" && (
                  <ClipboardList className="h-4 w-4" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {current.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs text-slate-500">
                  {current.subtitle}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-5">
              <ul className="space-y-1.5 text-xs text-slate-600">
                {current.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-[6px] h-1 w-1 rounded-full bg-slate-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {current.cta && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-1 text-xs"
                    onClick={() => {
                      if (current.id === "search") {
                        window.location.href = "/test/search";
                      } else if (current.id === "compare") {
                        window.location.href = "/test/quote";
                      } else {
                        window.location.href = "/test/quote/request";
                      }
                    }}
                  >
                    {current.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
