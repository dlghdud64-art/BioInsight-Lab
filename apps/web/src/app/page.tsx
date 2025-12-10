import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
import { MainFooter } from "./_components/main-footer";
import { HeroSection } from "./_components/hero-section";
import { BetaBannerSection } from "./_components/beta-banner-section";
import { KeyValueSection } from "./_components/key-value-section";
import { ComparisonSection } from "./_components/comparison-section";
import { FlowSection } from "./_components/flow-section";
import { FeaturesShowcaseSection } from "./_components/features-showcase-section";
import { PersonaSection } from "./_components/persona-section";
import { AISection } from "./_components/ai-section";
import { SafetyRegulationTeaserSection } from "./_components/safety-regulation-teaser-section";
import { SecuritySection } from "./_components/security-section";
import { PricingSection } from "./_components/pricing-section";
import { FinalCTASection } from "./_components/final-cta-section";

export default function HomePage() {
  return (
    <MainLayout>
      <MainHeader />
      {/* 전체 레이아웃 컨테이너 */}
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="space-y-24">
          <HeroSection />
          <BetaBannerSection />
          <KeyValueSection />
          <ComparisonSection />
          <FlowSection />
          <FeaturesShowcaseSection />
          <PersonaSection />
          <AISection />
          <SafetyRegulationTeaserSection />
          <SecuritySection />
          <PricingSection />
          <FinalCTASection />
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
