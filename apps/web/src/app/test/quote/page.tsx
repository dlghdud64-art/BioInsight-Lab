"use client";

import { useState } from "react";
import { QuotePanel } from "../_components/quote-panel";
import { VendorResponsesPanel } from "../_components/vendor-responses-panel";

export default function QuotePage() {
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  return (
    <div className="space-y-4 mt-8">
      {/* 헤더 */}
      <div className="pt-8 md:pt-16 border-b border-slate-200 pb-4 md:pb-6 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl md:text-3xl font-bold text-slate-900 mb-1 md:mb-2">견적 요청서</h1>
          <p className="text-sm md:text-base text-slate-600 leading-relaxed">
            선택한 품목을 정리하고 견적 요청을 보내세요.
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

