"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState, useRef } from "react";
import { QuoteRequestPanel, QuoteItemsSummaryPanel, type QuoteRequestPanelRef } from "../../_components/quote-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function QuoteRequestPageContent() {
  const [vendorNotes, setVendorNotes] = useState<Record<string, string>>({});
  const requestPanelRef = useRef<QuoteRequestPanelRef>(null);

  const handleVendorNoteChange = (vendorId: string, note: string) => {
    setVendorNotes((prev) => ({
      ...prev,
      [vendorId]: note,
    }));
    requestPanelRef.current?.markDirty();
  };

  return (
    <div className="space-y-4 md:space-y-6 px-3 sm:px-4">
      {/* 뒤로가기 + 단계 표시 */}
      <div className="flex items-center gap-4">
        <Link href="/test/quote">
          <Button variant="outline" size="sm" className="text-xs h-8 sm:h-9">
            <ArrowLeft className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">견적 요청 리스트로 돌아가기</span>
            <span className="sm:hidden">돌아가기</span>
          </Button>
        </Link>
      </div>

      {/* 헤더 */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-1">견적 요청서 작성</h1>
        <p className="text-sm text-slate-500">요청 메시지와 배송 정보를 입력한 뒤 발송하세요.</p>
      </div>

      {/* 견적 요청 폼 + 요약 패널 */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
        {/* 좌측: 견적 요청 폼 (8칸) */}
        <div className="w-full order-2 lg:order-1 lg:col-span-8">
          <QuoteRequestPanel ref={requestPanelRef} vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
        </div>

        {/* 우측: 견적 요청 품목 요약 패널 (4칸) */}
        <div className="w-full order-1 lg:order-2 lg:col-span-4">
          <QuoteItemsSummaryPanel vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
        </div>
      </div>
    </div>
  );
}

export default function QuoteRequestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QuoteRequestPageContent />
    </Suspense>
  );
}
