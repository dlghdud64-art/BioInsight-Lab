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
    <div className="w-full min-h-screen" style={{ backgroundColor: "#020617" }}>
      {/* 1. Plexus Hero — full viewport, 자체 nav 포함 */}
      <BioInsightHeroSection />

      {/* 2. Trust Strip */}
      <BioInsightSocialProofSection />

      {/* 3. Platform Flow */}
      <PlatformFlowSection />

      {/* 4. Ops Console Preview */}
      <OpsConsolePreviewSection />

      {/* 5. Final CTA */}
      <FinalCTASection />

      {/* Footer */}
      <MainFooter />
    </div>
  );
}
