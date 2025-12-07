"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    id: "search",
    label: "검색",
    stepLabel: "Step 1",
    title: "검색 · AI 분석",
    description:
      "제품명, 타깃, 카테고리로 검색하면 후보 제품을 한 번에 확인하고, GPT가 검색어를 분석해 타깃/카테고리를 함께 제안합니다.",
    ctaLabel: "검색 플로우 체험하기",
    href: "/test/search",
  },
  {
    id: "compare",
    label: "비교",
    stepLabel: "Step 2",
    title: "비교 · 품목 리스트 만들기",
    description:
      "필요한 제품만 골라 비교하고, 실제로 구매 요청에 사용할 품목 리스트를 만들어 둡니다. 수량과 비고만 채우면 리스트가 완성됩니다.",
    ctaLabel: "비교 플로우 체험하기",
    href: "/test/quote",
  },
  {
    id: "groupware",
    label: "그룹웨어",
    stepLabel: "Step 3",
    title: "그룹웨어에 붙여넣기",
    description:
      "완성된 품목 리스트를 TSV/엑셀 형태로 복사해 사내 그룹웨어 결재 양식에 그대로 붙여넣을 수 있습니다. 기존 구매 프로세스는 그대로 유지합니다.",
    ctaLabel: "그룹웨어용 리스트 보기",
    href: "/test/quote/request",
  },
];

export function DemoFlowSwitcher() {
  const [active, setActive] = React.useState<string>("search");
  const router = useRouter();

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          3단계 데모 플로우
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          검색 → 비교 → 그룹웨어 붙여넣기까지 실제 화면 흐름을 간단히 살펴볼 수 있습니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={active} onValueChange={setActive}>
          {/* 상단 토글 / 탭 */}
          <TabsList className="mb-4 grid grid-cols-3 bg-slate-50">
            {STEPS.map((step) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900"
                onMouseEnter={() => setActive(step.id)} // 마우스 올려도 전환
              >
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 탭 내용 */}
          {STEPS.map((step) => (
            <TabsContent
              key={step.id}
              value={step.id}
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                      {step.stepLabel.replace("Step ", "")}
                    </span>
                    <span>{step.stepLabel}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-col items-start gap-2 md:mt-0 md:items-end">
                  {/* 나중에 실제 데모 이미지/스크린샷 썸네일 넣을 자리 */}
                  {/* 
                  <div className="h-20 w-40 rounded-md border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-center">
                    스크린샷 / 미니 데모
                  </div>
                  */}
                  <Button
                    size="sm"
                    className="mt-1 bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => router.push(step.href)}
                  >
                    {step.ctaLabel}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

