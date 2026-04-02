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
 *  2. Capability   (#0B1E35)  2×2 rich card — 4개 운영 surface
 *       검색 워크벤치 / 비교 판단면 / 요청·견적 작업면 / 입고·재고 운영면
 *       각 카드: 단계 라벨 → 정의 → 처리 객체 → 핵심 판단 → handoff
 *  3. Delta Proof  (#0E1D32)  6단계 파이프라인 — 기존 병목 → LabAxis 해소
 *       컬럼: 단계 / 핵심 / 기존 방식의 병목 / LabAxis에서 바로 바뀌는 점
 *  4. Workbench    (#0E1D32)  3카드 — 판단 포인트 · 객체 · 다음 액션
 *       작업 큐 정리 / 일일 검토·판단 / 입고 후 운영 연결
 *  5. Conversion   (#0A1525)  행동 전환 CTA
 *
 *  스크롤 방향: 선언 → 역량 구조 → 운영 증거 → 작업면 → 행동
 *  원칙: "기능 카드 금지 — operating capability architecture만 허용"
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
