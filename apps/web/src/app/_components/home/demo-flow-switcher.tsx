"use client";

// 중복 정의 제거 및 UTF-8 인코딩 문제 수정
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
    title: "검색으로 최적을 찾아 선택하기",
    subtitle:
      "제품명 또는 키워드로 검색하면 관련 제품이 자동으로 추천됩니다.",
    bullets: [
      "GPT가 검색 의도를 분석하여 관련 제품을 우선순위로 추천",
      "카테고리 / 키워드 / Grade로 필터링",
      "선택한 제품을 바로 견적 요청 리스트에 추가",
    ],
    cta: "검색하러 가기",
  },
  {
    id: "compare",
    label: "비교",
    badge: "Step 2",
    title: "필요한 제품들을 선택하여 비교 · 견적 요청 리스트 만들기",
    subtitle: "가격과 수량을 입력하면 견적 요청 리스트가 자동으로 생성됩니다.",
    bullets: [
      "카테고리 / 스펙 / 가격을 한눈에 비교",
      "수량, 가격을 입력하면 견적 요청 리스트가 자동 생성",
      "엑셀 형식으로 복사하여 바로 사용 가능",
    ],
    cta: "견적 요청 리스트로 이동하기",
  },
  {
    id: "groupware",
    label: "그룹웨어에 붙여넣기",
    badge: "Step 3",
    title: "그룹웨어 구매 요청 양식에 붙여넣기",
    subtitle:
      "생성된 견적 요청 리스트를 TSV/엑셀 형식으로 복사하여 그룹웨어에 붙여넣을 수 있습니다.",
    bullets: [
      "생성된 견적 요청 리스트를 TSV/엑셀 형식으로 복사",
      "구매 요청 양식에 그룹웨어로 붙여넣기",
      "이후에는 기존 구매 프로세스/그룹웨어로 진행",
    ],
    cta: "구매 요청 양식으로 가기",
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
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4">
        <header className="text-center space-y-1">
          <p className="text-xs font-medium text-slate-500">
            3단계 사용 흐름
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            검색부터 비교까지 그룹웨어까지의 전체 프로세스를 단계별로 확인할 수 있습니다.
          </h2>
        </header>

        <div className="w-full max-w-xl space-y-4">
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
