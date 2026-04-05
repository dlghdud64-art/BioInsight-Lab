import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import { FinalCTASection } from "./_components/final-cta-section";

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  Role tokens: brand-field → closure (card floats) → close-layer
 *  메인 nav는 BioInsightHeroSection 내 fixed nav로 항상 상단 고정
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen bg-public-close-layer">
      {/* 1. Hero — headline + CTA + inline product mockup (fixed nav 포함) */}
      <BioInsightHeroSection />

      {/* 2. Product Overview — lifted support section */}
      <FinalCTASection />

      {/* 3. Footer — dark close */}
      <MainFooter />
    </div>
  );
}
