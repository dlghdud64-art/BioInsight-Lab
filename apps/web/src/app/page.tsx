"use client";

import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import { FinalCTASection } from "./_components/final-cta-section";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

/* ── Section definitions for navbar ────────────────────────────── */
const SECTIONS = [
  { id: "landing-hero",   label: "제품 소개" },
  { id: "landing-ops",    label: "운영 흐름" },
  { id: "landing-footer", label: "시작하기" },
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

/* ── LandingNavbar — 스크롤 시 나타나는 모션 네비바 ───────────── */
function LandingNavbar() {
  const active = useActiveSection(SECTIONS.map((s) => s.id));
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
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
                      layoutId="landing-nav-indicator"
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

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  Role tokens: brand-field → closure (card floats) → close-layer
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen bg-public-close-layer">
      <LandingNavbar />

      {/* 1. Hero — headline + CTA + inline product mockup */}
      <div id="landing-hero">
        <BioInsightHeroSection />
      </div>

      {/* 2. Product Overview — lifted support section */}
      <div id="landing-ops">
        <FinalCTASection />
      </div>

      {/* 3. Footer — dark close */}
      <div id="landing-footer">
        <MainFooter />
      </div>
    </div>
  );
}
