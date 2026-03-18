import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
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
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        {/* 1. Hero: 운영 가치 제안 + 6단계 파이프라인 */}
        <BioInsightHeroSection />

        {/* 2. Trust Strip: 운영 메트릭 */}
        <BioInsightSocialProofSection />

        {/* 3. Platform Flow: 6단계 운영 파이프라인 상세 */}
        <PlatformFlowSection />

        {/* 4. Ops Console Preview: 4-mode 콘솔 소개 */}
        <OpsConsolePreviewSection />

        {/* 5. Final CTA: Enterprise 톤 */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
