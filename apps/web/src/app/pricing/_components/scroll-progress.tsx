"use client";
/**
 * §pricing-고도화 P3 — 상단 스크롤 진행바. 긴 요금 페이지 위치 피드백.
 *   z-50(헤더 z-40 위), 스크롤 비율만큼 width%.
 */
import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return (
    <div aria-hidden className="fixed top-0 left-0 z-50 h-[2px] transition-[width] duration-75"
      style={{ width: `${pct}%`, background: "linear-gradient(90deg,#3B82F6,#6f97ee)" }} />
  );
}
