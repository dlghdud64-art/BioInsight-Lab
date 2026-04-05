"use client";

import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import {
  Search, GitCompare, FileText, ShoppingCart, ClipboardCheck, Warehouse,
  ArrowRight, Shield, History, Wallet, BarChart3, Zap, CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode, useState, useEffect, useRef, useCallback } from "react";

/* ── Palette ─────────────────────────────────────────────────────
  Dark: hero + closing
  Light: editorial body sections
  Blue = CTA / accent only. No green.
────────────────────────────────────────────────────────────────── */
const D = {
  bg: "#0B1120",
  text1: "#F1F5F9",
  text2: "#94A3B8",
  primary: "#3B82F6",
  primarySoft: "#60A5FA",
  onPrimary: "#FFFFFF",
} as const;

const L = {
  bg: "#FFFFFF",
  bgSoft: "#F0F4F8",     /* 톤 구분 강화: #F8FAFC → #F0F4F8 (white와 확실히 구별) */
  bgMuted: "#E8EDF3",
  text1: "#0F172A",
  text2: "#334155",
  text3: "#64748B",
  text4: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#D6DEE8",  /* soft gray 섹션용 카드 보더 */
  blue: "#3B82F6",
  blueSoft: "#DBEAFE",
  blueText: "#1D4ED8",
  blueDark: "#1E3A5F",
} as const;

/* ── Section definitions ───────────────────────────────────────── */
const SECTIONS = [
  { id: "hero",       label: "소개" },
  { id: "connection", label: "연결 포인트" },
  { id: "structure",  label: "제품 구조" },
  { id: "roles",      label: "역할별 변화" },
  { id: "data",       label: "데이터" },
  { id: "cta",        label: "시작하기" },
] as const;

/* ── useActiveSection — IntersectionObserver 기반 ──────────────── */
function useActiveSection(sectionIds: readonly string[]) {
  const [active, setActive] = useState(sectionIds[0]);

  useEffect(() => {
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        /* 가장 많이 보이는 섹션을 active로 설정 */
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.1, 0.2, 0.3, 0.5] },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds]);

  return active;
}

/* ── IntroNavbar — 스크롤 시 나타나는 모션 네비바 ─────────────── */
function IntroNavbar() {
  const active = useActiveSection(SECTIONS.map((s) => s.id));
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.nav
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed top-0 left-0 w-full z-50 flex items-center justify-center"
          style={{
            backgroundColor: "rgba(11,17,32,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(59,130,246,0.12)",
          }}
        >
          <div className="flex items-center gap-1 px-4 h-12 overflow-x-auto no-scrollbar">
            {SECTIONS.map((sec) => {
              const isActive = active === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollTo(sec.id)}
                  className="relative px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors"
                  style={{ color: isActive ? "#F1F5F9" : "#64748B" }}
                >
                  {sec.label}
                  {isActive && (
                    <motion.div
                      layoutId="intro-nav-indicator"
                      className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                      style={{ backgroundColor: "#3B82F6" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

/* ── Scroll animation wrapper ──────────────────────────────────── */
function Reveal({ children, delay = 0, y = 40, className = "" }: {
  children: ReactNode; delay?: number; y?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <IntroNavbar />
      <div className="w-full">

        {/* ══ A. Hero — dark ═══════════════════════════════════════════ */}
        <section id="hero" className="relative pt-32 pb-28 md:pt-44 md:pb-36 overflow-hidden" style={{ backgroundColor: D.bg }}>
          {/* Dot grid background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(rgba(148,163,184,0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
          {/* Center haze */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse 800px 500px at 50% 40%, rgba(59,130,246,0.08), transparent 70%)",
          }} />

          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-sm font-medium tracking-wide mb-5"
              style={{ color: D.text2 }}
            >
              연구 구매 운영 플랫폼
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]"
              style={{ color: D.text1 }}
            >
              연구 구매 운영의 흐름을<br />
              <span style={{ color: D.primarySoft }}>하나로 연결합니다.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
              style={{ color: D.text2 }}
            >
              시약·장비 검색, 후보 정리, 비교·선택, 요청 생성, 발주 준비까지<br className="hidden md:block" />
              분리된 구매 작업을 하나의 운영 흐름으로 정리합니다.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link href="/search">
                <button className="w-full sm:w-auto px-7 py-3.5 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: D.primary, color: D.onPrimary }}>
                  제품 시작하기
                </button>
              </Link>
              <Link href="/support">
                <button className="w-full sm:w-auto px-7 py-3.5 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98]" style={{ color: D.text1, border: "1px solid rgba(255,255,255,0.15)" }}>
                  도입 문의
                </button>
              </Link>
            </motion.div>
          </div>

          {/* ── Flow cards panel (hero 하단) ── */}
          <div className="relative z-10 max-w-5xl mx-auto px-6 mt-16 md:mt-20">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              {/* Decision Flow card */}
              <div className="rounded-2xl p-6 md:p-7" style={{
                background: "linear-gradient(135deg, #1E3A5F 0%, #1A2E4A 100%)",
                border: "1px solid rgba(59,130,246,0.2)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}>
                <h3 className="text-xl font-bold mb-2" style={{ color: D.primarySoft }}>의사결정 흐름</h3>
                <p className="text-sm mb-5" style={{ color: "rgba(148,163,184,0.8)" }}>
                  검색, 비교, 선택까지 의사결정에 필요한 흐름을 연결합니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Search, title: "통합 검색" },
                    { icon: GitCompare, title: "비교·선택" },
                  ].map((s) => (
                    <div key={s.title} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <s.icon className="h-5 w-5 mb-2" style={{ color: D.primarySoft }} strokeWidth={1.8} />
                      <p className="text-sm font-semibold" style={{ color: D.text1 }}>{s.title}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operation Flow card */}
              <div className="rounded-2xl p-6 md:p-7" style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              }}>
                <h3 className="text-xl font-bold mb-2" style={{ color: D.text1 }}>운영 반영 흐름</h3>
                <p className="text-sm mb-5" style={{ color: D.text2 }}>
                  요청, 발주 준비, 입고, 재고까지 운영 흐름을 이어줍니다.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: ShoppingCart, title: "발주 준비" },
                    { icon: Warehouse, title: "재고 운영" },
                  ].map((s) => (
                    <div key={s.title} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <s.icon className="h-5 w-5 mb-2" style={{ color: D.text2 }} strokeWidth={1.8} />
                      <p className="text-sm font-semibold" style={{ color: D.text1 }}>{s.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══ B. 운영 연결 포인트 — white + progress bars ══════════════ */}
        <section id="connection" className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1 }}>
          <div className="max-w-5xl mx-auto px-6">
            <Reveal>
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">LabAxis 운영 연결 포인트</h2>
                <p className="text-base" style={{ color: L.text3 }}>각 단계가 다음 작업으로 자연스럽게 이어집니다.</p>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Search, label: "검색 → 후보 정리", pct: 92 },
                { icon: GitCompare, label: "비교 → 선택안 확정", pct: 85 },
                { icon: FileText, label: "요청 생성 → 초안 작성", pct: 78 },
                { icon: ShoppingCart, label: "발주 준비 → 전환 검토", pct: 70 },
                { icon: ClipboardCheck, label: "입고 반영 → lot 기록", pct: 65 },
              ].map((item, i) => (
                <Reveal key={item.label} delay={i * 0.08}>
                  <div className="rounded-xl p-5" style={{ backgroundColor: L.bgSoft, border: `1px solid ${L.border}` }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                        <item.icon className="h-4.5 w-4.5" style={{ color: L.blueText }} strokeWidth={1.8} />
                      </div>
                      <span className="text-sm font-semibold" style={{ color: L.text1 }}>{item.label}</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: L.bgMuted }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: L.blue }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ C. 제품 구조 설명 — soft gray + 2-column editorial ═══════ */}
        <section id="structure" className="py-20 md:py-28" style={{ backgroundColor: L.bgSoft, color: L.text1, borderTop: `1px solid ${L.border}` }}>
          <div className="max-w-6xl mx-auto px-6">

            {/* C-1: 연구 & 구매 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-24">
              <Reveal>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                    <Search className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
                  </div>
                  <span className="text-sm font-bold tracking-wide" style={{ color: L.blue }}>Research &amp; Procurement</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                  검색부터 요청까지,<br />끊기지 않는 구매 흐름
                </h3>
                <p className="text-base leading-relaxed" style={{ color: L.text2 }}>
                  시약·장비를 검색하면 후보 정리, 비교·선택, 요청 생성까지 같은 화면 안에서 이어집니다. 각 단계의 결정 기록이 다음 단계로 자동 연결됩니다.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: Search, title: "통합 검색", desc: "품목·제조사·카탈로그 기준으로 탐색하고 후보를 바로 저장" },
                    { icon: FileText, title: "요청 생성", desc: "선택안 기준으로 요청안을 작성하고 발주 준비로 연결" },
                  ].map((card) => (
                    <div key={card.title} className="rounded-xl p-5 flex items-start gap-4" style={{ backgroundColor: L.bg, border: `1px solid ${L.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: L.blueSoft }}>
                        <card.icon className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="font-semibold mb-1" style={{ color: L.text1 }}>{card.title}</p>
                        <p className="text-sm" style={{ color: L.text3 }}>{card.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* C-2: 조직 운영 (reverse layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <Reveal delay={0.15} className="order-2 lg:order-1">
                <div className="flex flex-col gap-4">
                  {[
                    { icon: Shield, title: "승인 기준과 권한", desc: "조직 구조에 맞는 승인 흐름과 역할별 권한을 정리" },
                    { icon: Wallet, title: "예산 기준 연결", desc: "과제별 예산과 구매 이력을 연결해 기준 이탈을 빠르게 감지" },
                  ].map((card) => (
                    <div key={card.title} className="rounded-xl p-5 flex items-start gap-4" style={{ backgroundColor: L.bg, border: `1px solid ${L.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: L.blueSoft }}>
                        <card.icon className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
                      </div>
                      <div>
                        <p className="font-semibold mb-1" style={{ color: L.text1 }}>{card.title}</p>
                        <p className="text-sm" style={{ color: L.text3 }}>{card.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal className="order-1 lg:order-2">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                    <Shield className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
                  </div>
                  <span className="text-sm font-bold tracking-wide" style={{ color: L.blue }}>Organization</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                  조직 기준이<br />뒤에서 자연스럽게 붙습니다
                </h3>
                <p className="text-base leading-relaxed" style={{ color: L.text2 }}>
                  구매 흐름을 막지 않으면서 승인 기준, 활동 기록, 예산 기준을 유지합니다. 운영 데이터가 쌓이면서 다음 판단 근거가 됩니다.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══ D. 역할별 변화 — white + before/after ════════════════════ */}
        <section id="roles" className="py-20 md:py-28" style={{ backgroundColor: L.bg, color: L.text1 }}>
          <div className="max-w-5xl mx-auto px-6">
            <Reveal>
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">도입 후 달라지는 흐름</h2>
                <p className="text-base" style={{ color: L.text3 }}>역할마다 반복은 줄이고, 연결은 강화합니다.</p>
              </div>
            </Reveal>

            <div className="flex flex-col gap-5">
              {[
                {
                  role: "연구원",
                  before: "여러 벤더를 따로 열고 품목을 수기로 모아 비교 준비",
                  after: "검색 결과에서 후보를 바로 정리하고 비교 단계로 이동",
                },
                {
                  role: "구매 담당",
                  before: "비교 결과를 다시 정리하고 전화·이메일로 수동 요청",
                  after: "선택안 기준으로 요청안을 만들고 발주 준비까지 연결",
                },
                {
                  role: "운영 관리자",
                  before: "구매 이력, 입고 상태, 재고를 각각 다른 문서에서 확인",
                  after: "선택 기록, 입고, 재고를 같은 흐름에서 추적",
                },
              ].map((card, i) => (
                <Reveal key={card.role} delay={i * 0.1}>
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${L.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr]">
                      {/* Role */}
                      <div className="flex items-center justify-center p-5 md:p-6" style={{ backgroundColor: L.blueSoft }}>
                        <span className="text-sm font-bold" style={{ color: L.blueText }}>{card.role}</span>
                      </div>
                      {/* Before */}
                      <div className="p-5 md:p-6" style={{ backgroundColor: L.bgSoft }}>
                        <p className="text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: L.text4 }}>이전</p>
                        <p className="text-sm" style={{ color: L.text2 }}>{card.before}</p>
                      </div>
                      {/* After */}
                      <div className="p-5 md:p-6" style={{ backgroundColor: L.bg }}>
                        <p className="text-[11px] font-bold tracking-wide uppercase mb-2" style={{ color: L.blue }}>LabAxis 이후</p>
                        <p className="text-sm font-medium" style={{ color: L.text1 }}>{card.after}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ E. 데이터 가시화 — soft gray + mockup card ═══════════════ */}
        <section id="data" className="py-20 md:py-28" style={{ backgroundColor: L.bgSoft, color: L.text1, borderTop: `1px solid ${L.border}` }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <Reveal>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: L.blueSoft }}>
                    <BarChart3 className="h-5 w-5" style={{ color: L.blueText }} strokeWidth={1.8} />
                  </div>
                  <span className="text-sm font-bold tracking-wide" style={{ color: L.blue }}>Data Visualization</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">
                  운영 데이터가 쌓이면<br />다음 판단이 빨라집니다
                </h3>
                <p className="text-base leading-relaxed" style={{ color: L.text2 }}>
                  품목별 구매 빈도, 공급사 조건 비교, 입고 이후 재고 흐름을 함께 보며 다음 구매 판단에 필요한 근거를 쌓습니다.
                </p>
              </Reveal>

              <Reveal delay={0.15}>
                {/* Mockup chart card */}
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: L.bg, border: `1px solid ${L.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
                  {/* Title bar */}
                  <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${L.border}` }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#EF4444" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22C55E" }} />
                    </div>
                  </div>
                  {/* Chart mockup */}
                  <div className="p-6">
                    <div className="flex items-end gap-2 h-32">
                      {[35, 50, 42, 65, 55, 78, 70, 85].map((h, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t-md"
                          style={{ backgroundColor: i >= 6 ? L.blue : L.blueSoft }}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-4 text-xs" style={{ color: L.text4 }}>
                      <span>3월 1주</span>
                      <span>3월 4주</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══ F. Closing CTA — dark ════════════════════════════════════ */}
        <section id="cta" className="py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: D.bg, color: D.text1 }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(rgba(148,163,184,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(circle at center, rgba(59,130,246,0.06), transparent 55%)",
          }} />

          <Reveal>
            <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-5 tracking-tight">
                지금 시작할 수 있습니다.
              </h2>
              <p className="text-base md:text-lg mb-10" style={{ color: D.text2 }}>
                검색부터 재고 운영까지, 조직에 맞는 범위부터 도입하세요.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/pricing">
                  <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98]" style={{ backgroundColor: D.primary, color: D.onPrimary }}>
                    요금 &amp; 플랜 보기
                  </button>
                </Link>
                <Link href="/support">
                  <button className="w-full sm:w-auto px-8 py-4 text-base font-bold rounded-xl transition-all hover:brightness-110 active:scale-[0.98] flex items-center gap-2" style={{ color: D.text1, border: "1px solid rgba(255,255,255,0.15)" }}>
                    도입 상담 <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

      </div>
      <MainFooter />
    </MainLayout>
  );
}
