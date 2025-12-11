"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, GitCompare, ShoppingCart } from "lucide-react";

// HeroDemoFlowPanel 컴포넌트 - 컴팩트 티저 버전 + 예시 UI
type StepId = "search" | "compare" | "list";

const HERO_STEPS = [
  {
    id: "search" as const,
    label: "Step 1 검색",
    title: "검색으로 후보를 한 번에 모으기",
    desc: "제품명, 타깃, 키워드로 여러 벤더 제품을 한 번에 모읍니다.",
  },
  {
    id: "compare" as const,
    label: "Step 2 비교",
    title: "스펙·가격 기준으로 후보 추리기",
    desc: "단위, Grade, 가격을 기준으로 후보를 비교하면서 최종 품목을 고릅니다.",
  },
  {
    id: "list" as const,
    label: "Step 3 리스트 정리",
    title: "구매 요청 리스트로 정리해서 내보내기",
    desc: "견적/구매 요청용으로 바로 공유·첨부할 수 있는 리스트 형식으로 정리합니다.",
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

export function HeroDemoFlowPanel() {
  const [step, setStep] = useState<StepId>("search");

  const current = HERO_STEPS.find((s) => s.id === step)!;

  const scrollToFlowSection = () => {
    const el = document.querySelector("#flow-section");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Card className="w-full max-w-sm shadow-sm border-slate-200">
      <CardHeader className="pb-3">
        <p className="text-xs font-medium text-slate-500">데모 플로우</p>
        <h3 className="text-sm font-semibold text-slate-900">
          3단계로 끝나는 구매 준비
        </h3>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step 탭 */}
        <div className="flex gap-1 rounded-full bg-slate-50 p-1 text-xs">
          {HERO_STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "flex-1 rounded-full px-2 py-1 text-center transition text-[10px]",
                s.id === step
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

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
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={scrollToFlowSection}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
          >
            3단계 플로우 자세히 보기
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
