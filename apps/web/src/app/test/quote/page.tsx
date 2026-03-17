"use client";

import { useState } from "react";
import { QuotePanel } from "../_components/quote-panel";
import { VendorResponsesPanel } from "../_components/vendor-responses-panel";

export default function QuotePage() {
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  return (
    <div className="space-y-2 md:space-y-4 mt-2 md:mt-8">
      {/* 헤더 */}
      <div className="pt-3 md:pt-16 border-b border-slate-200 pb-2.5 md:pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-lg md:text-3xl font-bold text-slate-900 mb-0.5 md:mb-2">견적 요청 리스트</h1>
          <p className="text-xs md:text-base text-slate-600 leading-relaxed">
            선택한 품목의 수량과 구성을 확인하세요. 편집이 끝나면 요청서 작성으로 넘어갑니다.
          </p>
        </div>
      </div>

      {/* 견적 요청 리스트 */}
      <div className="w-full">
        <QuotePanel onQuoteSaved={setSavedQuoteId} />
      </div>

      {/* 벤더 회신 패널 - 견적이 저장되었을 때만 표시 */}
      {savedQuoteId && (
        <div className="w-full">
          <VendorResponsesPanel quoteId={savedQuoteId} />
        </div>
      )}
    </div>
  );
}

