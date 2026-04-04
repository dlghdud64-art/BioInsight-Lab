import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full" style={{ backgroundColor: "#0E1B2E" }} /> }
);

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  색상 리듬: dark hero (with mockup) → LIFTED support → dark footer
 *
 *  1. Hero (#081425)       headline + CTA + inline mockup (제품이 주인공)
 *  2. Support (#334155)    제품 흐름 아이콘 그리드
 *  3. Footer (#020617)     dark close layer
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#020617" }}>
      {/* 1. Hero — headline + CTA + inline product mockup */}
      <BioInsightHeroSection />

      {/* 2. Product Overview — lifted support section */}
      <FinalCTASection />

      {/* 3. Footer — dark close */}
      <MainFooter />
    </div>
  );
}
