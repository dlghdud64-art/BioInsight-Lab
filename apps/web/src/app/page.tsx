import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import { BioInsightSocialProofSection } from "./_components/bioinsight-social-proof-section";
import dynamic from "next/dynamic";

const PlatformFlowSection = dynamic(
  () => import("./_components/platform-flow-section").then((mod) => ({ default: mod.PlatformFlowSection })),
  { loading: () => <div className="h-96 w-full bg-el" /> }
);

const OpsConsolePreviewSection = dynamic(
  () => import("./_components/ops-console-preview-section").then((mod) => ({ default: mod.OpsConsolePreviewSection })),
  { loading: () => <div className="h-64 w-full bg-el" /> }
);

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-el" /> }
);

/*
 * ── Landing Page — Surface Grammar ────────────────────────────────
 *  A. Flagship Surface  (#071A33)  Hero — 선언과 진입
 *  B. Bridge Surface    (#0B1E35)  병목 증거 → proof 연결
 *  C. Proof Surfaces    (#0E1D32)  Operational Delta + Workbench Teaser
 *  D. Conversion Surface(#0A1525)  행동 전환 CTA
 *  스크롤 방향: 브랜딩 → 운영 → 행동 (점점 구체적, 점점 운영적)
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* A. Flagship Surface — Hero */}
      <BioInsightHeroSection />

      {/* A→B seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* B. Bridge Surface — 병목 증거 + 절감 요약 */}
      <BioInsightSocialProofSection />

      {/* C-1. Proof Surface — Operational Delta Matrix */}
      <PlatformFlowSection />

      {/* C-2. Proof Surface — Workbench Teaser Cards */}
      <OpsConsolePreviewSection />

      {/* D. Conversion Surface — CTA */}
      <FinalCTASection />

      {/* D→Footer seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
