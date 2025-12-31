"use client";

import { useState } from "react";
import { QuotePanel } from "../_components/quote-panel";
import { VendorResponsesPanel } from "../_components/vendor-responses-panel";

export default function QuotePage() {
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900 mb-1">Step 3: 견적 요청</h1>
        <p className="text-sm text-slate-600">선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.</p>
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

