"use client";

import { QuotePanel, SharePanel } from "../_components/quote-panel";

export default function QuotePage() {
  return (
    <div className="space-y-6">
      {/* 견적 요청 리스트 - 가로로 넓게 */}
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

