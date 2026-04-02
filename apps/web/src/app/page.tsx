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
 * ── Landing Page — Product Architecture ───────────────────────────
 *  1. Flagship    (#071A33)  Hero — 선언 + signal blue 강화
 *       headline glow, CTA shadow, pipeline hover, network 0.30
 *  2. Product Frame (#0B1E35)  3개 대형 운영 계층 프레임
 *       Sourcing & Compare → Request & Approval → Receive & Stock
 *       각 프레임: stage label / title / flow strip / 4 points / handoff
 *  3. Delta Proof  (#0E1D32)  6단계 파이프라인 — 기존 병목 → 해소
 *  4. Workbench    (#0E1D32)  3카드 — 판단 포인트 · 객체 · 다음 액션
 *  5. Conversion   (#0A1525)  행동 전환 CTA
 *
 *  스크롤: 선언 → 제품 구조 인지 → 운영 변화 납득 → 작업면 → 행동
 *  원칙: "텍스트를 읽기 전에도 제품 구조가 먼저 보여야 함"
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* 1. Flagship — Hero 선언 (signal blue 강화) */}
      <BioInsightHeroSection />

      {/* 1→2 seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* 2. Product Architecture Frame — 3개 대형 운영 계층 */}
      <BioInsightSocialProofSection />

      {/* 3. Operating Delta — 6단계 파이프라인 병목 제거 증거 */}
      <PlatformFlowSection />

      {/* 4. Workbench Preview — 판단 포인트 중심 3카드 */}
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
