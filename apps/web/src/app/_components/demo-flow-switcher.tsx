"use client";

// 중복 정의 제거 - React import 중복 제거
import { useState } from "react";
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
      "제품명 또는 키워드로 검색하면 관련 제품이 자동으로 추천되고, GPT가 검색 의도를 분석하여 키워드 기반 필터를 자동으로 적용합니다.",
    ctaLabel: "검색하러 가기",
    href: "/test/search",
  },
  {
    id: "compare",
    label: "비교",
    stepLabel: "Step 2",
    title: "비교 · 견적 요청 리스트 만들기",
    description:
      "필요한 제품들을 선택하여 비교하고, 가격과 수량을 입력하면 견적 요청 리스트가 자동으로 생성됩니다. 수량과 비교를 조정하면 리스트가 자동으로 업데이트됩니다.",
    ctaLabel: "비교하러 가기",
    href: "/test/quote",
  },
  {
    id: "groupware",
    label: "그룹웨어",
    stepLabel: "Step 3",
    title: "그룹웨어에 붙여넣기",
    description:
      "생성된 견적 요청 리스트를 TSV/엑셀 형식으로 복사하여 그룹웨어 구매 요청 양식에 붙여넣을 수 있습니다. 기존 구매 프로세스와 동일한 형식으로 제공됩니다.",
    ctaLabel: "그룹웨어로 리스트 붙여넣기",
    href: "/test/quote/request",
  },
];

export function DemoFlowSwitcher() {
  const [active, setActive] = useState<string>("search");
  const router = useRouter();

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">
          3단계 사용 흐름
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          검색부터 비교까지 그룹웨어 연동까지의 전체 프로세스를 단계별로 확인할 수 있습니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={active} onValueChange={setActive}>
          {/* 탭 버튼 그룹 */}
          <TabsList className="mb-4 grid grid-cols-3 bg-slate-50">
            {STEPS.map((step) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-900"
                onMouseEnter={() => setActive(step.id)}
              >
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 콘텐츠 영역 */}
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
