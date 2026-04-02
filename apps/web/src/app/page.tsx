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
 * ── Landing Page — Capability Architecture ────────────────────────
 *  1. Flagship    (#071A33)  Hero — 선언과 진입
 *  2. Capability   (#0B1E35)  4개 운영 surface 압축 제시
 *  3. Delta Proof  (#0E1D32)  6단계 파이프라인 병목→해소
 *  4. Workbench    (#0E1D32)  실제 작업면 절단 preview
 *  5. Conversion   (#0A1525)  행동 전환 CTA
 *
 *  스크롤 방향: 선언 → 역량 구조 → 운영 증거 → 작업면 → 행동
 *  "hero 아래 = capability architecture, not feature grid"
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* 1. Flagship — Hero 선언 */}
      <BioInsightHeroSection />

      {/* 1→2 seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* 2. Capability Band — 4개 운영 surface가 책임지는 구간 */}
      <BioInsightSocialProofSection />

      {/* 3. Operating Delta — 6단계 파이프라인 병목 제거 증거 */}
      <PlatformFlowSection />

      {/* 4. Workbench Preview — 각 작업면의 실제 구조 */}
      <OpsConsolePreviewSection />

      {/* 5. Conversion — 행동 전환 CTA */}
      <FinalCTASection />

      {/* 5→Footer seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
