import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const OpsConsolePreviewSection = dynamic(
  () => import("./_components/ops-console-preview-section").then((mod) => ({ default: mod.OpsConsolePreviewSection })),
  { loading: () => <div className="h-64 w-full" style={{ backgroundColor: "#060E1C" }} /> }
);

const BioInsightSocialProofSection = dynamic(
  () => import("./_components/bioinsight-social-proof-section").then((mod) => ({ default: mod.BioInsightSocialProofSection })),
  { loading: () => <div className="h-48 w-full bg-el" /> }
);

const PlatformFlowSection = dynamic(
  () => import("./_components/platform-flow-section").then((mod) => ({ default: mod.PlatformFlowSection })),
  { loading: () => <div className="h-48 w-full bg-el" /> }
);

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-48 w-full bg-el" /> }
);

/*
 * ── Landing Page — Product-Proof First ──────────────────────────────
 *  구조: 메시지 → 제품 → 신뢰 → 최소 설명
 *  원칙: "설명을 읽기 전에 제품이 먼저 보일 것"
 *
 *  1. Hero          headline + 1줄 sub + CTA 2개
 *  2. Product Proof hero-attached surface — 발주 전환 큐 mockup
 *  3. Trust Strip   고객사 로고만
 *  4. Architecture  1줄 제목 + 3 token strip
 *  5. Delta         1행 1줄 매트릭스
 *  6. CTA           최종 action
 *  7. Footer        legal / support
 * ────────────────────────────────────────────────────────────────────
 */
export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* 1. Hero — headline + CTA */}
      <BioInsightHeroSection />

      {/* 2. Product Proof Surface — hero에서 바로 이어지는 제품 증명 */}
      <OpsConsolePreviewSection />

      {/* 3. Trust Strip — 로고만 */}
      <section className="py-8 md:py-10" style={{ backgroundColor: "#081628", borderTop: "1px solid #0F1F35", borderBottom: "1px solid #162A42" }}>
        <div className="max-w-[1100px] mx-auto px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-center mb-6" style={{ color: "#3A5068" }}>
            혁신적인 바이오 기업과 연구소들이 선택했습니다
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {["SAMSUNG BIO", "CELLTRION", "SK bioscience", "KAIST", "서울대 의대"].map((name) => (
              <span key={name} className="text-[14px] md:text-[16px] font-extrabold tracking-tight" style={{ color: "#2A3A50" }}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Architecture Strip — 3 token만 */}
      <BioInsightSocialProofSection />

      {/* 5. Delta — 1행 1줄 매트릭스 */}
      <PlatformFlowSection />

      {/* 6. CTA */}
      <FinalCTASection />

      {/* 7. Footer */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />
      <MainFooter />
    </div>
  );
}
