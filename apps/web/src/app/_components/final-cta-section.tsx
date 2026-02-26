"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function FinalCTASection() {
  const { toast } = useToast();

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const shareData = {
      title: "BioInsight Lab - 바이오 R&D 구매 플랫폼",
      text: "연구실 재고 관리와 구매 프로세스를 한 곳에서 통합 관리하세요.",
      url: `${url}/intro`,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({ title: "공유 링크가 전송되었습니다." });
      } else {
        await navigator.clipboard.writeText(`${url}/intro`);
        toast({ title: "링크가 클립보드에 복사되었습니다." });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(`${url}/intro`);
        toast({ title: "링크가 클립보드에 복사되었습니다." });
      }
    }
  };

  return (
    <section className="py-8 md:py-10 bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <div className="rounded-xl border-2 border-blue-200 bg-white p-6 md:p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold mb-2 text-slate-900 tracking-tight">
            지금 바로 시작하기
          </h2>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            검색/비교를 시작하고 견적 요청 리스트를 만들어보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link href="/test/search" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-11 bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 font-semibold">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="w-full sm:w-auto h-11 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 flex items-center justify-center gap-2"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              팀에 공유
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
