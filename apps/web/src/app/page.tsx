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

      {/* 1.5. Hero → Content seam: hard cut with thin separator */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#1E3050" }} />

      {/* 2. Trust Strip */}
      <BioInsightSocialProofSection />

      {/* 3. Platform Flow */}
      <PlatformFlowSection />

      {/* 4. Ops Console Preview */}
      <OpsConsolePreviewSection />

      {/* 4.5. Ops → CTA seam */}

      {/* 5. Final CTA */}
      <FinalCTASection />

      {/* 5.5. CTA → Footer seam */}
      <div aria-hidden="true" style={{ height: 1, backgroundColor: "#D7E0EB" }} />

      {/* 6. Footer */}
      <MainFooter />
    </div>
  );
}
