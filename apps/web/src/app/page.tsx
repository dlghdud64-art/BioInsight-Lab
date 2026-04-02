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
 * ── Landing Page — Product Operating Surface ──────────────────────
 *  1. Flagship    (#071A33)  Hero — 선언 + signal blue 강화
 *       headline glow 45%, CTA shadow 45%, pipeline active nodes, plexus 0.35
 *  2. Architecture Strip (#0B1E35)  3 프레임 — action strip + 3 token
 *       Sourcing & Compare → Request & PO Handoff → Receive & Stock
 *  3. Delta Proof  (#0E1D32)  5행 한줄 매트릭스 — 병목 → 해소
 *  4. Live Preview (#0E1D32)  실제 화면 split — 후보 리스트 + AI 선택안 rail
 *  5. Action Surface (#0A1525)  운영 흐름 예시 → CTA 종속
 *
 *  원칙: "텍스트를 읽기 전에 운영 체인이 먼저 보일 것"
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* 1. Flagship — Hero 선언 (signal blue 강화) */}
      <BioInsightHeroSection />

      {/* 1→2 seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* 2. Architecture Strip — action strip + 3 token */}
      <BioInsightSocialProofSection />

      {/* 3. Delta Proof — 5행 한줄 매트릭스 */}
      <PlatformFlowSection />

      {/* 4. Live Action Preview — split: 후보 + AI 선택안 */}
      <OpsConsolePreviewSection />

      {/* 5. Action Surface — 운영 흐름 예시 → CTA */}
      <FinalCTASection />

      {/* 5→Footer seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
