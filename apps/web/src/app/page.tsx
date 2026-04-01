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

      {/* 1.5. Hero → Content bridge: navy → slate-blue → mist gray-blue → section tint */}
      <div
        aria-hidden="true"
        style={{
          height: 180,
          background:
            "linear-gradient(180deg, #071a33 0%, #0a2040 10%, #102b4a 22%, #1a3858 36%, #284868 50%, #3d5d7e 62%, #5a7896 74%, #7e96ae 84%, #a3b5c8 91%, #c4d0dd 96%, #dbe4ed 100%)",
        }}
      />

      {/* 2. Trust Strip */}
      <BioInsightSocialProofSection />

      {/* 3. Platform Flow */}
      <PlatformFlowSection />

      {/* 4. Ops Console Preview */}
      <OpsConsolePreviewSection />

     