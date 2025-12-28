"use client";

export const dynamic = 'force-dynamic';

import { QuoteRequestPanel, QuoteItemsSummaryPanel } from "../../_components/quote-panel";
import { QuoteRepliesPanel } from "../../_components/quote-replies-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function QuoteRequestPage() {
  return (
    <div className="space-y-4 md:space-y-6 px-3 sm:px-4">
      {/* 뒤로가기 버튼 */}
      <div className="flex items-center gap-4">
        <Link href="/test/quote">
          <Button variant="outline" size="sm" className="text-xs h-8 sm:h-9">
            <ArrowLeft className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">견적 요청 리스트로 돌아가기</span>
            <span className="sm:hidden">돌아가기</span>
          </Button>
        </Link>
      </div>

      {/* 탭 */}
      <Tabs defaultValue="request" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="request">견적 요청</TabsTrigger>
          <TabsTrigger value="replies">회신</TabsTrigger>
        </TabsList>

        {/* 견적 요청 탭 */}
        <TabsContent value="request" className="mt-4">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            {/* 좌측: 견적 요청 폼 */}
            <div className="w-full order-2 lg:order-1">
              <QuoteRequestPanel />
            </div>

            {/* 우측: 견적 요청 품목 요약 패널 */}
            <div className="w-full order-1 lg:order-2">
              <QuoteItemsSummaryPanel />
            </div>
          </div>
        </TabsContent>

        {/* 회신 탭 */}
        <TabsContent value="replies" className="mt-4">
          <QuoteRepliesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}