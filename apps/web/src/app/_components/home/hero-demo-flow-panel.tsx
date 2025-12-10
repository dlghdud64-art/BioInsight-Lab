"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Search, GitCompare, ShoppingCart } from "lucide-react";

// HeroDemoFlowPanel 컴포넌트 - 실제 화면 모형 UI 추가
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

// 검색 결과 샘플 데이터
const SAMPLE_SEARCH_RESULTS = [
  { name: "Human IL-6 ELISA Kit", vendor: "R&D Systems", price: "₩450,000" },
  { name: "IL-6 Quantikine ELISA", vendor: "Bio-Techne", price: "₩520,000" },
  { name: "Human IL-6 ELISA", vendor: "Abcam", price: "₩380,000" },
];

// 품목 리스트 샘플 데이터
const SAMPLE_QUOTE_ITEMS = [
  { no: 1, name: "Human IL-6 ELISA Kit", qty: 2, price: "₩900,000" },
  { no: 2, name: "PCR Master Mix", qty: 1, price: "₩150,000" },
];

export function HeroDemoFlowPanel() {
  const [active, setActive] = useState<HeroStepId>("search");
  const [searchAnimation, setSearchAnimation] = useState(false);
  const current = HERO_STEPS.find((s) => s.id === active)!;

  // 자동 슬라이드 애니메이션
  useEffect(() => {
    const interval = setInterval(() => {
      setActive((prev) => {
        if (prev === "search") return "compare";
        if (prev === "compare") return "groupware";
        return "search";
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // 검색 애니메이션
  useEffect(() => {
    if (active === "search") {
      setSearchAnimation(true);
      const timer = setTimeout(() => setSearchAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  const scrollToDemo = () => {
    const el = document.getElementById("demo-flow-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-lg">
      <p className="mb-3 text-xs font-medium text-slate-500">데모 플로우</p>

      {/* Step 토글 버튼들 */}
      <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
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

      {/* 실제 화면 모형 UI - 고정 높이 */}
      <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm min-h-[280px]">
        {active === "search" && (
          <div className="space-y-3 h-full flex flex-col">
            {/* 검색창 */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Human IL-6 ELISA kit
              </div>
              <button className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700">
                검색
              </button>
            </div>
            
            {/* 검색 결과 카드 리스트 */}
            <div className="flex-1 min-h-0">
              {searchAnimation ? (
                <div className="space-y-2 h-full overflow-y-auto">
                  {SAMPLE_SEARCH_RESULTS.map((result, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 animate-in fade-in slide-in-from-top-2"
                      style={{ animationDelay: `${idx * 200}ms` }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {result.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {result.vendor}
                          </p>
                        </div>
                        <p className="text-xs font-medium text-slate-900 ml-2">
                          {result.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[10px] text-slate-400 h-full flex items-center justify-center">
                  검색어를 입력하고 검색 버튼을 클릭하세요
                </div>
              )}
            </div>
          </div>
        )}

        {active === "compare" && (
          <div className="space-y-3 h-full flex flex-col">
            {/* 비교 테이블 헤더 */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2 flex-shrink-0">
              <GitCompare className="h-3 w-3" />
              <span>제품 비교 (3개)</span>
            </div>
            
            {/* 비교 항목 */}
            <div className="space-y-1.5 flex-1 overflow-y-auto">
              {["제품명", "벤더", "가격", "납기"].map((label, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[10px]">
                  <span className="w-12 text-slate-500 flex-shrink-0">{label}</span>
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((col) => (
                      <div
                        key={col}
                        className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 truncate"
                      >
                        {label === "가격" ? `₩${(450 + col * 50)}k` : `항목 ${col}`}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "groupware" && (
          <div className="space-y-3 h-full flex flex-col">
            {/* 품목 리스트 테이블 */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 border-b border-slate-200 pb-2 flex-shrink-0">
              <ShoppingCart className="h-3 w-3" />
              <span>품목 리스트</span>
            </div>
            
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-slate-600 pb-1 border-b border-slate-100 flex-shrink-0">
              <div className="col-span-1">No</div>
              <div className="col-span-5">제품명</div>
              <div className="col-span-2">수량</div>
              <div className="col-span-4">금액</div>
            </div>
            
            {/* 테이블 행 */}
            <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
              {SAMPLE_QUOTE_ITEMS.map((item) => (
                <div
                  key={item.no}
                  className="grid grid-cols-12 gap-1 text-[10px] text-slate-700 py-1"
                >
                  <div className="col-span-1">{item.no}</div>
                  <div className="col-span-5 truncate">{item.name}</div>
                  <div className="col-span-2">{item.qty}</div>
                  <div className="col-span-4 font-medium">{item.price}</div>
                </div>
              ))}
            </div>
            
            {/* 복사 버튼 */}
            <button className="w-full rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] text-white hover:bg-slate-800 flex-shrink-0">
              그룹웨어에 복사하기
            </button>
          </div>
        )}
      </div>

      {/* 선택된 Step의 요약 설명 */}
      <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className="mb-0.5 text-xs font-semibold leading-tight text-slate-900 line-clamp-2">
          {current.title}
        </p>
        <p className="text-[11px] leading-tight text-slate-500 line-clamp-2">
          {current.description}
        </p>
      </div>

      {/* 아래 상세 데모 섹션으로 스크롤 */}
      <div className="flex justify-end">
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
