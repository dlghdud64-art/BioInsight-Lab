"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, GitCompare, ShoppingCart, FlaskConical } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// HeroDemoFlowPanel 컴포넌트 - 컴팩트 티저 버전 + 예시 UI
type StepId = "search" | "compare" | "list" | "protocol";

const HERO_STEPS = [
  {
    id: "search" as const,
    order: 1,
    label: "검색",
    title: "검색 & 후보 모으기",
    desc: "제품명, 벤더, 카테고리로 여러 제품을 한 번에 검색하고, 마음에 드는 것만 후보 리스트에 담아보세요.",
  },
  {
    id: "compare" as const,
    order: 2,
    label: "비교",
    title: "제품 비교 & 대체품 정리",
    desc: "담아둔 후보 제품을 한 화면에서 가격, 규격, Grade 등을 비교하고, 실제로 쓸 제품만 남깁니다.",
  },
  {
    id: "list" as const,
    order: 3,
    label: "품목 리스트",
    title: "리스트 정리 & 공유",
    desc: "확정된 품목 리스트를 TSV/엑셀로 내보내 동료·구매팀과 공유할 수 있습니다.",
  },
  {
    id: "protocol" as const,
    order: 4,
    label: "프로토콜 분석",
    title: "프로토콜 분석",
    desc: "실험 프로토콜 텍스트를 붙여넣으면 필요한 시약·장비를 자동으로 추출합니다.",
  },
];

// 샘플 데이터
const SAMPLE_SEARCH_RESULTS = [
  { name: "Human IL-6 ELISA Kit", vendor: "R&D Systems", price: "₩450,000" },
  { name: "IL-6 Quantikine ELISA", vendor: "Bio-Techne", price: "₩520,000" },
  { name: "Human IL-6 ELISA", vendor: "Abcam", price: "₩380,000" },
];

const SAMPLE_COMPARE_DATA = [
  { label: "제품명", values: ["Human IL-6 ELISA Kit", "IL-6 Quantikine ELISA", "Human IL-6 ELISA"] },
  { label: "벤더", values: ["R&D Systems", "Bio-Techne", "Abcam"] },
  { label: "가격", values: ["₩450,000", "₩520,000", "₩380,000"] },
  { label: "납기", values: ["7일", "5일", "10일"] },
  { label: "재고", values: ["재고 있음", "재고 있음", "주문 필요"] },
  { label: "최소주문", values: ["1개", "1개", "2개"] },
];

const SAMPLE_QUOTE_ITEMS = [
  { no: 1, name: "Human IL-6 ELISA Kit", qty: 2, price: "₩900,000" },
  { no: 2, name: "PCR Master Mix", qty: 1, price: "₩150,000" },
  { no: 3, name: "96 Well Plate", qty: 5, price: "₩375,000" },
];

// Step 탭 컴포넌트
function HeroStepTabs({ activeId, onChange }: { activeId: StepId; onChange: (id: StepId) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {HERO_STEPS.map((step) => {
        const active = step.id === activeId;
        return (
          <button
            key={step.id}
            onClick={() => onChange(step.id)}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-2 py-2 text-xs transition-colors",
              active
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600"
            )}
          >
            <span className="text-[11px] opacity-80">Step {step.order}</span>
            <span className="mt-0.5 font-medium text-[10px] leading-tight">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 단계 안내 Sheet 컴포넌트
function HeroStepHelp() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors">
          단계 안내 보기
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[80%] max-w-xs">
        <SheetHeader>
          <SheetTitle>기능 체험 단계 안내</SheetTitle>
          <SheetDescription className="mt-2 text-xs">
            검색 → 비교 → 품목 리스트 → 프로토콜 분석까지 한 번에 체험해 보세요.
          </SheetDescription>
        </SheetHeader>

        <ol className="mt-4 space-y-3 text-sm">
          <li>
            <span className="font-semibold">Step 1. 제품 검색</span>
            <p className="text-xs text-slate-500 mt-1">
              제품명, 벤더, 카테고리 키워드로 후보를 한 번에 모읍니다.
            </p>
          </li>
          <li>
            <span className="font-semibold">Step 2. 비교</span>
            <p className="text-xs text-slate-500 mt-1">
              스펙·Grade·가격 등을 기준으로 후보를 비교합니다.
            </p>
          </li>
          <li>
            <span className="font-semibold">Step 3. 품목 리스트</span>
            <p className="text-xs text-slate-500 mt-1">
              선택한 제품으로 구매 요청용 품목 리스트를 자동으로 만듭니다.
            </p>
          </li>
          <li>
            <span className="font-semibold">Step 4. 프로토콜 분석</span>
            <p className="text-xs text-slate-500 mt-1">
              실험 프로토콜을 붙여넣으면 필요한 시약·장비를 자동으로 추출합니다.
            </p>
          </li>
        </ol>
      </SheetContent>
    </Sheet>
  );
}

export function HeroDemoFlowPanel() {
  const [step, setStep] = useState<StepId>("search");

  const current = HERO_STEPS.find((s) => s.id === step)!;

  const scrollToFlowSection = useCallback(() => {
    if (typeof window === "undefined") return;
    
    const el = document.getElementById("flow-section");
    if (el) {
      const headerHeight = 56;
      const elementTop = el.offsetTop;
      const offsetPosition = elementTop - headerHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
      return;
    }

    // 요소가 없으면 재시도
    const scrollToElement = (attempts = 0) => {
      const element = document.getElementById("flow-section");
      if (element) {
        const headerHeight = 56;
        const elementTop = element.offsetTop;
        const offsetPosition = elementTop - headerHeight;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: "smooth",
        });
      } else if (attempts < 20) {
        setTimeout(() => scrollToElement(attempts + 1), 100);
      }
    };
    
    setTimeout(() => scrollToElement(), 50);
  }, []);

  return (
    <Card className="w-full max-w-sm shadow-sm border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            기능 체험
          </h3>
          <HeroStepHelp />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          검색 → 비교 → 품목 리스트 → 프로토콜 분석
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step 탭 */}
        <HeroStepTabs activeId={step} onChange={setStep} />

        {/* 예시 UI 영역 - 작은 크기 */}
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm min-h-[180px]">
          {step === "search" && (
            <div className="space-y-1.5 h-full flex flex-col">
              {/* 검색창 */}
              <div className="flex gap-1.5 flex-shrink-0">
                <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-600">
                  Human IL-6 ELISA kit
                </div>
                <button className="rounded bg-blue-600 px-1.5 py-0.5 text-[9px] text-white">
                  검색
                </button>
              </div>
              
              {/* 검색 결과 */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-0.5">
                  {SAMPLE_SEARCH_RESULTS.map((result, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-slate-200 bg-white p-1"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-semibold text-slate-900 truncate leading-tight">
                            {result.name}
                          </p>
                          <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">
                            {result.vendor}
                          </p>
                        </div>
                        <p className="text-[9px] font-medium text-slate-900 whitespace-nowrap ml-1">
                          {result.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "compare" && (
            <div className="space-y-2 h-full flex flex-col">
              {/* 비교 헤더 */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 border-b border-slate-200 pb-1.5 flex-shrink-0">
                <GitCompare className="h-3 w-3" />
                <span>제품 비교 (3개)</span>
              </div>
              
              {/* 비교 항목 */}
              <div className="space-y-1 flex-1 overflow-y-auto">
                {SAMPLE_COMPARE_DATA.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-12 text-slate-500 flex-shrink-0 text-right pr-1">{row.label}</span>
                    <div className="flex-1 grid grid-cols-3 gap-0.5">
                      {row.values.map((value, colIdx) => (
                        <div
                          key={colIdx}
                          className={`rounded px-1 py-0.5 text-[9px] text-slate-600 ${
                            row.label === "가격" && colIdx === 2 ? "bg-green-50 text-green-700 font-semibold" :
                            row.label === "납기" && colIdx === 1 ? "bg-blue-50 text-blue-700 font-semibold" :
                            "bg-slate-50"
                          }`}
                          title={value}
                        >
                          <span className="truncate block">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "list" && (
            <div className="space-y-2 h-full flex flex-col">
              {/* 리스트 헤더 */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 border-b border-slate-200 pb-1.5 flex-shrink-0">
                <ShoppingCart className="h-3 w-3" />
                <span>품목 리스트</span>
              </div>
              
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-12 gap-0.5 text-[9px] font-semibold text-slate-600 pb-1 border-b border-slate-100 flex-shrink-0">
                <div className="col-span-1">No</div>
                <div className="col-span-6">제품명</div>
                <div className="col-span-2">수량</div>
                <div className="col-span-3">금액</div>
              </div>
              
              {/* 테이블 행 */}
              <div className="space-y-0.5 flex-1 overflow-y-auto min-h-0">
                {SAMPLE_QUOTE_ITEMS.map((item) => (
                  <div
                    key={item.no}
                    className="grid grid-cols-12 gap-0.5 text-[9px] text-slate-700 py-0.5 border-b border-slate-50 last:border-0"
                  >
                    <div className="col-span-1 font-medium">{item.no}</div>
                    <div className="col-span-6 truncate">{item.name}</div>
                    <div className="col-span-2 text-center">{item.qty}</div>
                    <div className="col-span-3 font-medium text-right">{item.price}</div>
                  </div>
                ))}
              </div>
              
              {/* 합계 */}
              <div className="grid grid-cols-12 gap-0.5 text-[9px] font-semibold text-slate-900 pt-1 border-t border-slate-200 flex-shrink-0">
                <div className="col-span-9 text-right pr-1">합계</div>
                <div className="col-span-3 text-right">₩1,425,000</div>
              </div>
            </div>
          )}

          {step === "protocol" && (
            <div className="space-y-2 h-full flex flex-col">
              {/* 프로토콜 분석 헤더 */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700 border-b border-slate-200 pb-1.5 flex-shrink-0">
                <FlaskConical className="h-3 w-3" />
                <span>프로토콜 분석</span>
              </div>
              
              {/* 프로토콜 입력 영역 */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-1.5">
                  <div className="rounded border border-slate-200 bg-slate-50 p-1.5 text-[9px] text-slate-600">
                    <p className="font-medium mb-1">프로토콜 텍스트:</p>
                    <p className="leading-relaxed">
                      "Add 100μL of blocking buffer...<br />
                      Incubate with primary antibody..."
                    </p>
                  </div>
                  
                  {/* 추출된 시약 */}
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-semibold text-slate-700">추출된 시약:</p>
                    {["Blocking Buffer", "Primary Antibody", "Wash Buffer"].map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-slate-200 bg-white p-1"
                      >
                        <p className="text-[9px] font-medium text-slate-900">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={scrollToFlowSection}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
          >
            자세히 보기
          </button>

          <Link href="/test/search">
            <Button size="sm" variant="outline" className="text-xs">
              이 플로우 직접 해보기
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
