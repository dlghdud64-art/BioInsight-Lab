"use client";

export const dynamic = 'force-dynamic';

import { Suspense, useState } from "react";
import { QuoteRequestPanel, QuoteItemsSummaryPanel } from "../../_components/quote-panel";
import { QuoteRepliesPanel } from "../../_components/quote-replies-panel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function QuoteRequestPageContent() {
  const [vendorNotes, setVendorNotes] = useState<Record<string, string>>({});

  const handleVendorNoteChange = (vendorId: string, note: string) => {
    setVendorNotes((prev) => ({
      ...prev,
      [vendorId]: note,
    }));
  };

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
        <TabsList className="grid w-full grid-cols-2 gap-1">
          <TabsTrigger value="request" className="text-xs md:text-sm whitespace-nowrap">
            <span className="hidden sm:inline">견적 요청</span>
            <span className="sm:hidden">견적</span>
          </TabsTrigger>
          <TabsTrigger value="replies" className="text-xs md:text-sm whitespace-nowrap">회신</TabsTrigger>
        </TabsList>

        {/* 견적 요청 탭 */}
        <TabsContent value="request" className="mt-4">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
            {/* 좌측: 견적 요청 폼 (8칸) */}
            <div className="w-full order-2 lg:order-1 lg:col-span-8">
              <QuoteRequestPanel vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
            </div>

            {/* 우측: 견적 요청 품목 요약 패널 (4칸) */}
            <div className="w-full order-1 lg:order-2 lg:col-span-4">
              <QuoteItemsSummaryPanel vendorNotes={vendorNotes} onVendorNoteChange={handleVendorNoteChange} />
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

export default function QuoteRequestPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QuoteRequestPageContent />
    </Suspense>
  );
}