import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import { FinalCTASection } from "./_components/final-cta-section";

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  Flow: Hero → Product Mockup → Footer
 *  핵심 가치 제안 + CTA + 제품 목업만 간결하게 구성
 *  상세 기능 소개는 /intro 에서 다룸
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen bg-public-close-layer">
      {/* 1. Hero — value proposition + CTA + inline product mockup */}
      <BioInsightHeroSection />

      {/* 2. Product Overview — 재고 운영 목업 + 지원 포인트 */}
      <FinalCTASection />

      {/* 3. Footer */}
      <MainFooter />
    </div>
  );
}
