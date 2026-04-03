import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const OpsConsolePreviewSection = dynamic(
  () => import("./_components/ops-console-preview-section").then((mod) => ({ default: mod.OpsConsolePreviewSection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#0A0F18" }} /> }
);

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full bg-el" /> }
);

/*
 * ── Landing Page — Product-Proof First ──────────────────────────────
 *  구조: 메시지 → 제품 → 최소 설명 → 법무/지원
 *  원칙: hero + proof만으로 제품 이해가 가능해야 함
 *
 *  1. Hero          headline + 1줄 sub + CTA 2개
 *  2. Product Proof 실제 구현 화면 기반 mockup
 *  3. CTA           최종 action
 *  4. Footer        legal / support
 *
 *  제거된 것:
 *  - trust logo strip (실제 협업 증빙 없음)
 *  - architecture strip (hero+proof로 충분)
 *  - delta matrix (설명 중복)
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#0A0F18" }}>
      {/* 1. Hero — headline + CTA */}
      <BioInsightHeroSection />

      {/* 2. Product Proof — 실제 구현 화면 기반 mockup */}
      <OpsConsolePreviewSection />

      {/* 3. CTA */}
      <FinalCTASection />

      {/* 4. Footer */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1A2030" }} />
      <MainFooter />
    </div>
  );
}
