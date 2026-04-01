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

export default function HomePage() {
  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#071A33" }}>
      {/* 1. Plexus Hero — full viewport, 자체 nav 포함 */}
      <BioInsightHeroSection />

      {/* 1.5. Hero → Content bridge: navy → blue-gray → muted slate (공기감 전이) */}
      <div
        aria-hidden="true"
        style={{
          height: 200,
          background:
            "linear-gradient(180deg, #071a33 0%, #0c2240 12%, #132e50 26%, #1e3d5e 40%, #2c4f6e 54%, #3e6380 66%, #54788f 76%, #6d8ea0 84%, #88a3b3 90%, #a3b8c6 95%, #c0cdd8 100%)",
        }}
      />

      {/* 2. Trust Strip */}
      <BioInsightSocialProofSection />

      {/* 3. Platform Flow */}
      <PlatformFlowSection />

      {/* 4. Ops Console Preview */}
      <OpsConsolePreviewSection />

      {/* 4.5. Ops → CTA bridge: light surface → muted blue-gray (자연 조명 변화) */}
      <div
        aria-hidden="true"
        style={{
          height: 160,
          background:
            "linear-gradient(180deg, #DCE5F0 0%, #d2dce8 10%, #c5d0de 22%, #b5c2d2 36%, #a2b1c4 50%, #8fa0b6 62%, #7c8fa7 74%, #697f98 84%, #566f8a 92%, #47607a 100%)",
        }}
      />

      {/* 5. Final CTA */}
      <FinalCTASection />

      {/* 5.5. CTA → Footer bridge: muted slate → navy (채도 낮은 전이) */}
      <div
        aria-hidden="true"
        style={{
          height: 120,
          background:
            "linear-gradient(180deg, #DCE5F0 0%, #c0cdd8 12%, #a0b0c0 26%, #8498ac 40%, #687f96 54%, #506880 66%, #3b536c 78%, #283f58 88%, #182d45 95%, #071A33 100%)",
        }}
      />

      {/* 6. Footer */}
      <MainFooter />
    </div>
  );
}
