import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full" style={{ backgroundColor: "#060e1e" }} /> }
);

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  색상 리듬: dark hero → dark closure (card floats) → dark footer
 *
 *  1. Hero (#081425)       headline + CTA + inline mockup
 *  2. Closure (#060e1e)    dark field + floating closure card
 *  3. Footer (#040c1a)     dark close layer
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
