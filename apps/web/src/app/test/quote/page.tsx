"use client";

import { useState } from "react";
import { QuotePanel } from "../_components/quote-panel";
import { VendorResponsesPanel } from "../_components/vendor-responses-panel";

export default function QuotePage() {
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  return (
    <div className="space-y-4 mt-8">
      {/* 헤더 - 진행바와 충분한 여백 확보 */}
      <div className="py-16 border-b border-slate-200 pb-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Step 3. 견적 요청서 작성</h1>
          <p className="text-base text-slate-600 leading-relaxed">
            선택한 품목으로 견적 요청 리스트를 만들고 내보내기합니다.
            <br />
            엑셀/TSV 파일로 다운로드하여 이메일 공유나 사내 전자결재에 활용할 수 있습니다.
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

