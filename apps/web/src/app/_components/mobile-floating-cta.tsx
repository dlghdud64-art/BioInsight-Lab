"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";

/** 모바일 전용 플로팅 CTA - 최하단 고정, 가입/문의 유도 (비로그인 전용) */
export function MobileFloatingCTA() {
  const { data: session } = useSession();

  // 로그인 상태에서는 플로팅 바 미표시
  if (session?.user) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111318]/95 backdrop-blur-md border-t border-[#2e3440] shadow-[0_-4px_12px_rgba(0,0,0,0.3)]">
        <Link href="/auth/signin?callbackUrl=/test/search" className="flex-1 max-w-[200px]">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-10 rounded-md">
            시작하기
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </Link>
        <a
          href="mailto:contact@labaxis.io"
          className="flex-1 max-w-[200px]"
        >
          <Button
            variant="outline"
            className="w-full border-[#363d4a] text-slate-300 font-medium text-sm h-10 rounded-xl"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            고객센터 문의
          </Button>
        </a>
      </div>
    </div>
  );
}
