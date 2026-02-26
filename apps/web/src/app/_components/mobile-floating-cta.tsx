"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, Rocket } from "lucide-react";

/** 모바일 전용 플로팅 CTA - 최하단 고정, 가입/문의 유도 */
export function MobileFloatingCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <Link href="/auth/signin?callbackUrl=/test/search" className="flex-1 max-w-[200px]">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-5 rounded-xl shadow-md">
            <Rocket className="h-4 w-4 mr-2" />
            시작하기
          </Button>
        </Link>
        <a
          href="mailto:contact@bioinsight.lab"
          className="flex-1 max-w-[200px]"
        >
          <Button
            variant="outline"
            className="w-full border-slate-300 font-medium text-sm py-5 rounded-xl"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            고객센터 문의
          </Button>
        </a>
      </div>
    </div>
  );
}
