"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function TestStepHelp() {
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

