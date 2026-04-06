import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import { FinalCTASection } from "./_components/final-cta-section";
import {
  ConnectionSection,
  RolesSection,
  DataSection,
  ClosingCTASection,
} from "./_components/landing-sections";

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  Flow: Hero → Connection → Product Overview → Roles → Data → CTA → Footer
 *  메인 nav는 BioInsightHeroSection 내 fixed nav로 항상 상단 고정
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen bg-public-close-layer">
      {/* 1. Hero — value proposition + CTA + inline product mockup */}
      <BioInsightHeroSection />

      {/* 2. Connection — 끊기지 않는 운영 연결 포인트 */}
      <ConnectionSection />

      {/* 3. Product Overview — 재고 운영 목업 + 지원 포인트 */}
      <FinalCTASection />

      {/* 4. Roles — 역할별 before/after 변화 */}
      <RolesSection />

      {/* 5. Data — 운영 데이터 시각화 */}
      <DataSection />

      {/* 6. Closing CTA — 도입 유도 */}
      <ClosingCTASection />

      {/* 7. Footer */}
      <MainFooter />
    </div>
  );
}
