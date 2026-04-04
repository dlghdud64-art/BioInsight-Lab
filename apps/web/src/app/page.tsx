import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const OpsConsolePreviewSection = dynamic(
  () => import("./_components/ops-console-preview-section").then((mod) => ({ default: mod.OpsConsolePreviewSection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#1e293b" }} /> }
);

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full bg-el" /> }
);

/*
 * ── Landing Page ──────────────────────────────────────────────────
 *  색상 리듬: dark hero → dark proof → LIFTED support → dark footer
 *
 *  1. Hero (#081425)       headline + CTA
 *  2. Proof (#1e293b)      mockup (dark window on lifted surface)
 *  3. Support (#334155)    제품 흐름 아이콘 그리드 (CTA 반복 없음)
 *  4. Footer (#020617)     dark close layer
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#020617" }}>
      {/* 1. Hero — deep navy */}
      <BioInsightHeroSection />

      {/* 2. Product Proof — lifted surface with dark mockup window */}
      <OpsConsolePreviewSection />

      {/* 3. Product Overview — lifted support section (밝은 레이어) */}
      <FinalCTASection />

      {/* 4. Footer — dark close */}
      <MainFooter />
    </div>
  );
}
