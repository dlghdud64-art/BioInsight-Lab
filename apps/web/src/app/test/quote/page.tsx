"use client";

import { QuotePanel, SharePanel } from "../_components/quote-panel";

export default function QuotePage() {
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900 mb-1">Step 3: 견적 요청</h1>
        <p className="text-sm text-slate-600">선정 품목으로 견적 요청 리스트를 만들고 내보내기합니다.</p>
      </div>
      
      {/* 견적 요청 리스트 */}
      <div className="w-full">
        <QuotePanel />
      </div>
      
      {/* 공유 패널 (내보내기 기능 포함) */}
      <div className="w-full">
        <SharePanel />
      </div>
    </div>
  );
}

