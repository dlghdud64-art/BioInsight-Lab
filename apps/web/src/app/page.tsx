import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
import { MainFooter } from "./_components/main-footer";
import { HeroSection } from "./_components/hero-section";
import dynamic from "next/dynamic";

// Lazy load below-the-fold sections for better initial page load
const BetaBannerSection = dynamic(() => import("./_components/beta-banner-section").then((mod) => ({ default: mod.BetaBannerSection })), {
  loading: () => <div className="h-16 w-full" />,
});
const KeyValueSection = dynamic(() => import("./_components/key-value-section").then((mod) => ({ default: mod.KeyValueSection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const ComparisonSection = dynamic(() => import("./_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const FlowSection = dynamic(() => import("./_components/flow-section").then((mod) => ({ default: mod.FlowSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const SafetyRegulationTeaserSection = dynamic(() => import("./_components/safety-regulation-teaser-section").then((mod) => ({ default: mod.SafetyRegulationTeaserSection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const FeaturesShowcaseSection = dynamic(() => import("./_components/features-showcase-section").then((mod) => ({ default: mod.FeaturesShowcaseSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const PersonaSection = dynamic(() => import("./_components/persona-section").then((mod) => ({ default: mod.PersonaSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const AISection = dynamic(() => import("./_components/ai-section").then((mod) => ({ default: mod.AISection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const SecuritySection = dynamic(() => import("./_components/security-section").then((mod) => ({ default: mod.SecuritySection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const PricingSection = dynamic(() => import("./_components/pricing-section").then((mod) => ({ default: mod.PricingSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const FinalCTASection = dynamic(() => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});

export default function HomePage() {
  return (
    <MainLayout>
      <MainHeader />
      {/* 전체 레이아웃 컨테이너 */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="space-y-6 md:space-y-10">
          <HeroSection />
          <BetaBannerSection />
          <KeyValueSection />
          <ComparisonSection />
          <FlowSection />
          <SafetyRegulationTeaserSection />
          <FeaturesShowcaseSection />
          <PersonaSection />
          <AISection />
          <SecuritySection />
          <PricingSection />
          <FinalCTASection />
        </div>
      </div>
      <MainFooter />
    </MainLayout>
  );
}
