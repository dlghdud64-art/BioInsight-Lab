"use client";

import { QuoteRequestPanel, QuoteItemsSummaryPanel } from "../../_components/quote-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function QuoteRequestPage() {
  return (
    <div className="space-y-6">
      {/* 뒤로가기 버튼 */}
      <div className="flex items-center gap-4">
        <Link href="/test/quote">
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-2" />
            품목 리스트로 돌아가기
          </Button>
        </Link>
      </div>

      {/* 2컬럼 레이아웃: 견적 요청 폼 + 품목 요약 패널 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        {/* 좌측: 견적 요청 폼 */}
        <div className="w-full">
          <QuoteRequestPanel />
        </div>

        {/* 우측: 구매 요청 품목 요약 패널 */}
        <div className="w-full">
          <QuoteItemsSummaryPanel />
        </div>
      </div>
    </div>
  );
}


import { QuoteRequestPanel, QuoteItemsSummaryPanel } from "../../_components/quote-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function QuoteRequestPage() {
  return (
    <div className="space-y-6">
      {/* 뒤로가기 버튼 */}
      <div className="flex items-center gap-4">
        <Link href="/test/quote">
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-2" />
            품목 리스트로 돌아가기
          </Button>
        </Link>
      </div>

      {/* 2컬럼 레이아웃: 견적 요청 폼 + 품목 요약 패널 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        {/* 좌측: 견적 요청 폼 */}
        <div className="w-full">
          <QuoteRequestPanel />
        </div>

        {/* 우측: 구매 요청 품목 요약 패널 */}
        <div className="w-full">
          <QuoteItemsSummaryPanel />
        </div>
      </div>
    </div>
  );
}


import { QuoteRequestPanel, QuoteItemsSummaryPanel } from "../../_components/quote-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function QuoteRequestPage() {
  return (
    <div className="space-y-6">
      {/* 뒤로가기 버튼 */}
      <div className="flex items-center gap-4">
        <Link href="/test/quote">
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="h-3 w-3 mr-2" />
            품목 리스트로 돌아가기
          </Button>
        </Link>
      </div>

      {/* 2컬럼 레이아웃: 견적 요청 폼 + 품목 요약 패널 */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        {/* 좌측: 견적 요청 폼 */}
        <div className="w-full">
          <QuoteRequestPanel />
        </div>

        {/* 우측: 구매 요청 품목 요약 패널 */}
        <div className="w-full">
          <QuoteItemsSummaryPanel />
        </div>
      </div>
    </div>
  );
}

