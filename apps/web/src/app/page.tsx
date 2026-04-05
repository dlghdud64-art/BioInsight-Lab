import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full bg-public-brand-field-strong" /> }
);

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  Role tokens: brand-field → closure (card floats) → close-layer
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen bg-public-close-layer">
      {/* 1. Hero — headline + CTA + inline product mockup */}
      <BioInsightHeroSection />

      {/* 2. Product Overview — lifted support section */}
      <FinalCTASection />

      {/* 3. Footer — dark close */}
      <MainFooter />
    </div>
  );
}
