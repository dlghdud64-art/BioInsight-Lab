"use client";

/**
 * §P-leg P1 — 법적 고지 허브 셸 (/legal · 탭형 단일 페이지)
 *
 * 정본: legal/법적 고지 허브 구현 지시문(호영님 2026-06-16).
 *   콘텐츠/표현 분리 — 법문은 lib/legal/legal-docs.tsx 단일 진실, 본 셸은 그것을 읽어
 *   탭·목차·본문·읽기시간을 자동 렌더.
 *
 * P1 범위: 네이비 셸 + 라이트 본문, 문서 스위처(슬라이딩 인디케이터), 스티키 목차(248px,
 *   920↓ select), 본문 렌더(조항 앵커), 해시 라우팅(#privacy 등), 읽기시간, 맨위로, 인쇄.
 * P2(앵커 복사 토스트·크로스페이드) / P3(다크 모드)는 후속 phase.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { Printer, ArrowUp } from "lucide-react";
import { LEGAL_DOCS, LEGAL_DOC_MAP, legalAnchorId, type LegalDoc } from "@/lib/legal/legal-docs";

/** 본문 글자 수로 예상 읽기 시간(550자/분, 지시문 ③). */
function readingMinutes(doc: LegalDoc): number {
  const text = JSON.stringify(doc.sections).replace(/<[^>]+>/g, "");
  return Math.max(1, Math.round(text.length / 550));
}

const DEFAULT_ID = "terms";

export default function LegalHubPage() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_ID);
  const [showTop, setShowTop] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const switchRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);

  // 해시 라우팅: #privacy / #privacy-5 진입 시 문서 선택(+ 앵커 스크롤).
  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) return;
      const docId = raw.split("-")[0];
      if (docId && LEGAL_DOC_MAP[docId]) {
        setActiveId(docId);
        // 앵커가 있으면 렌더 후 스크롤.
        requestAnimationFrame(() => {
          const el = document.getElementById(raw);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // 슬라이딩 인디케이터: 활성 탭 위치/너비 측정해 이동(지시문 ①).
  const moveIndicator = useCallback(() => {
    const wrap = switchRef.current;
    const ind = indRef.current;
    if (!wrap || !ind) return;
    const btn = wrap.querySelector<HTMLButtonElement>('button[aria-selected="true"]');
    if (!btn) return;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.transform = `translateX(${btn.offsetLeft}px)`;
  }, []);

  useEffect(() => {
    moveIndicator();
    window.addEventListener("resize", moveIndicator);
    return () => window.removeEventListener("resize", moveIndicator);
  }, [activeId, moveIndicator]);

  // 맨 위로 노출(520px↑, 지시문 ⑥).
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 조항 앵커 딥링크 복사 + 토스트(지시문 ②) — "약관 제13조"를 정확히 공유.
  const copyAnchor = useCallback((anchor: string) => {
    const url = `${window.location.origin}/legal#${anchor}`;
    history.replaceState(null, "", `#${anchor}`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => setToast("조항 링크가 복사되었습니다"))
        .catch(() => setToast("복사에 실패했습니다"));
    } else {
      setToast("복사에 실패했습니다");
    }
  }, []);

  // 토스트 자동 해제.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const doc = LEGAL_DOC_MAP[activeId] ?? LEGAL_DOCS[0]!;
  const minutes = useMemo(() => readingMinutes(doc), [doc]);

  const selectDoc = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToSection = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${anchor}`);
    }
  };

  return (
    <MainLayout>
      <MainHeader />

      {/* ── 히어로 + 문서 스위처 + 메타바 ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 md:pt-16">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8794AA] mb-3">
          법적 고지 · Legal
        </div>
        <h1 className="text-2xl md:text-[34px] font-bold text-white tracking-tight leading-tight mb-2">
          {doc.title}
        </h1>
        <p className="text-sm md:text-[15px] text-[#8794AA] max-w-2xl leading-relaxed">{doc.subtitle}</p>

        {/* 문서 스위처(슬라이딩 인디케이터) */}
        <div
          ref={switchRef}
          className="legal-switch relative mt-6 inline-flex gap-1 rounded-xl border border-[#1E2D40] bg-[#0d1730]/60 p-1"
          role="tablist"
          aria-label="법적 고지 문서 선택"
        >
          <span ref={indRef} className="legal-ind" aria-hidden />
          {LEGAL_DOCS.map((d) => {
            const active = d.id === activeId;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectDoc(d.id)}
                className={`relative z-10 min-h-[40px] rounded-lg px-3.5 text-[13px] font-semibold transition-colors ${
                  active ? "text-white" : "text-[#8794AA] hover:text-[#BAC6D9]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* 메타바 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#8794AA] border-t border-[#1E2D40] pt-4">
          <span>시행일 {doc.effective}</span>
          <span className="text-[#46506a]">·</span>
          <span>최종 개정 {doc.revised}</span>
          <span className="text-[#46506a]">·</span>
          <span className="rounded-md bg-[#16284c] px-1.5 py-0.5 font-semibold text-[#a9c2f5]">{doc.version}</span>
          <span className="text-[#46506a]">·</span>
          <span>약 {minutes}분 분량</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[#1E2D40] px-2.5 py-1 font-semibold text-[#BAC6D9] transition-colors hover:bg-[#16284c]"
          >
            <Printer className="h-3.5 w-3.5" />
            인쇄 · PDF
          </button>
        </div>
      </div>

      {/* ── 라이트 본문 영역(목차 + 본문) ── */}
      <div className="legal-paper mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="legal-grid">
            {/* 스티키 목차(920↓ select) */}
            <aside className="legal-toc">
              <div className="legal-toc-sticky">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">목차</p>
                {/* 데스크탑 목차 리스트 */}
                <nav className="legal-toc-list">
                  {doc.sections.map((s) => {
                    const anchor = legalAnchorId(doc.id, s.no);
                    return (
                      <button
                        key={anchor}
                        type="button"
                        onClick={() => scrollToSection(anchor)}
                        className="legal-toc-item"
                      >
                        <span className="legal-toc-no">{s.no}</span>
                        <span className="legal-toc-title">{s.title}</span>
                      </button>
                    );
                  })}
                </nav>
                {/* 모바일 select */}
                <select
                  className="legal-toc-select"
                  aria-label="조항 이동"
                  onChange={(e) => e.target.value && scrollToSection(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>조항으로 이동…</option>
                  {doc.sections.map((s) => (
                    <option key={s.no} value={legalAnchorId(doc.id, s.no)}>
                      {s.no} {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </aside>

            {/* 본문 */}
            <article className="legal-body legal-prose" key={doc.id}>
              {doc.intro && <div className="legal-intro">{doc.intro}</div>}
              {doc.sections.map((s) => {
                const anchor = legalAnchorId(doc.id, s.no);
                return (
                  <section key={anchor} id={anchor} className="legal-section">
                    <h2>
                      <span className="legal-section-no">{s.no}</span>
                      <span className="legal-h2-title">{s.title}</span>
                      <button
                        type="button"
                        className="legal-anchor-btn"
                        aria-label={`${s.no} 링크 복사`}
                        onClick={() => copyAnchor(anchor)}
                      >
                        #
                      </button>
                    </h2>
                    {s.body}
                  </section>
                );
              })}
              {doc.addendum && (
                <section className="legal-section legal-addendum">
                  <h2>부칙</h2>
                  {doc.addendum}
                </section>
              )}
            </article>
          </div>
        </div>
      </div>

      <MainFooter />

      {/* 맨 위로 */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="맨 위로"
          className="fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#3b6ee5] text-white shadow-lg transition-transform hover:scale-105"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      {/* 조항 링크 복사 토스트(지시문 ②) */}
      {toast && (
        <div className="legal-toast" role="status" aria-live="polite">{toast}</div>
      )}

      {/* 허브 전용 스타일(콘텐츠/표현 분리 — .legal-prose 가 본문 styling 소유) */}
      <style jsx global>{`
        .legal-paper { background: #f4f6f9; }
        .legal-grid { display: grid; gap: 40px; grid-template-columns: 248px minmax(0, 1fr); }
        @media (max-width: 920px) { .legal-grid { grid-template-columns: 1fr; gap: 20px; } }
        .legal-toc-sticky { position: sticky; top: 88px; }
        .legal-toc-list { display: flex; flex-direction: column; gap: 2px; }
        @media (max-width: 920px) { .legal-toc-list { display: none; } }
        .legal-toc-item { display: flex; gap: 8px; align-items: baseline; text-align: left; padding: 6px 10px; border-radius: 8px; color: #46506a; font-size: 13px; line-height: 1.4; transition: background .15s, color .15s; }
        .legal-toc-item:hover { background: #eef2fe; color: #16284c; }
        .legal-toc-no { color: #3b6ee5; font-weight: 700; font-size: 11px; flex-shrink: 0; min-width: 30px; }
        .legal-toc-select { display: none; width: 100%; padding: 10px 12px; border: 1px solid #d9dfe8; border-radius: 10px; background: #fff; color: #121a2c; font-size: 14px; }
        @media (max-width: 920px) { .legal-toc-select { display: block; } }
        .legal-prose { color: #121a2c; font-size: 15px; line-height: 1.75; }
        .legal-intro { color: #46506a; padding-bottom: 8px; margin-bottom: 8px; }
        .legal-section { scroll-margin-top: 96px; padding: 22px 0; border-bottom: 1px solid #e7ebf1; }
        .legal-section:last-child { border-bottom: none; }
        .legal-prose h2 { display: flex; align-items: baseline; gap: 10px; font-size: 17px; font-weight: 700; color: #121a2c; margin-bottom: 12px; }
        .legal-section-no { color: #3b6ee5; font-size: 13px; font-weight: 700; }
        .legal-prose p { margin-bottom: 8px; }
        .legal-prose strong { color: #121a2c; font-weight: 700; }
        .legal-prose ol { list-style: decimal; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; }
        .legal-prose ul { list-style: disc; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; color: #46506a; }
        .legal-prose li ul { margin-top: 4px; }
        .legal-note { color: #6b7488; font-size: 12px; margin-top: 8px; }
        .legal-table-wrap { overflow-x: auto; margin: 6px 0; }
        .legal-prose table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 480px; }
        .legal-prose th { text-align: left; color: #6b7488; font-weight: 600; padding: 9px 12px; border-bottom: 2px solid #d9dfe8; }
        .legal-prose td { padding: 9px 12px; border-bottom: 1px solid #e7ebf1; color: #46506a; vertical-align: top; }
        .legal-prose td:first-child { color: #121a2c; font-weight: 500; }
        .legal-ind { position: absolute; top: 4px; bottom: 4px; left: 0; border-radius: 8px; background: linear-gradient(135deg, #3b6ee5, #4f7cea); transition: transform .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1); z-index: 0; }
        @media (prefers-reduced-motion: reduce) { .legal-ind { transition: none; } }
        .legal-anchor-btn { opacity: 0; margin-left: 4px; color: #3b6ee5; font-weight: 700; font-size: 14px; line-height: 1; cursor: pointer; transition: opacity .15s; }
        .legal-section:hover .legal-anchor-btn, .legal-anchor-btn:focus-visible { opacity: 1; }
        .legal-body { animation: legalSwap .32s cubic-bezier(.4,0,.2,1); }
        @keyframes legalSwap { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .legal-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #0a1124; color: #fff; padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 28px -10px rgba(0,0,0,.45); z-index: 50; animation: legalToast .25s ease; }
        @keyframes legalToast { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .legal-body, .legal-toast { animation: none; } }
        @media print { .legal-paper { background: #fff; } .legal-anchor-btn, .legal-toast { display: none; } }
      `}</style>
    </MainLayout>
  );
}
