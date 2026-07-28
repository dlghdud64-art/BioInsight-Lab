"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/** 모바일 전용 플로팅 CTA - 최하단 고정, 가입/문의 유도 (비로그인 전용)
 *
 * §intro-mobile-revamp:
 *  - CTA 문구·목적지 통일 — "무료로 시작하기" → /search (§landing-cta-search canon,
 *    구 signin 경유 "시작하기" 폐기).
 *  - 문의 버튼 저대비(연회색 텍스트) → 라이트 바 기준 text-slate-700 +
 *    1.5px #CBD5E1 보더 (AA 대비). radius 11px 통일(rounded-md/rounded-xl 혼재 제거).
 *  - 스크롤 방향 반응: 아래로 스크롤 시 숨김, 위로 스크롤 시 표시.
 *  - #cta(클로징 CTA) 섹션 가시 범위에서 자동 숨김 — CTA 중복 제거.
 */
export function MobileFloatingCTA() {
  const { data: session } = useSession();
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);
  const lastY = useRef(0);

  // 스크롤 방향 감지 — down = 숨김, up = 표시
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) > 8) {
        setHiddenByScroll(dy > 0 && y > 120);
        lastY.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // #cta 섹션 가시 시 자동 숨김 (클로징 CTA 와 중복 제거)
  useEffect(() => {
    const target = document.getElementById("cta");
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => setCtaVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // 로그인 상태에서는 플로팅 바 미표시
  if (session?.user) return null;

  const hidden = hiddenByScroll || ctaVisible;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-out"
      style={{ transform: hidden ? "translateY(100%)" : "translateY(0)" }}
      aria-hidden={hidden}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
        <Link href="/search" className="flex-1 max-w-[200px]">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-10 rounded-[11px]">
            무료로 시작하기
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </Link>
        <a
          href="mailto:support@labaxis.co.kr"
          className="flex-1 max-w-[200px]"
        >
          <Button
            variant="outline"
            className="w-full border-[1.5px] border-[#CBD5E1] bg-transparent text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium text-sm h-10 rounded-[11px]"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            고객센터 문의
          </Button>
        </a>
      </div>
    </div>
  );
}
