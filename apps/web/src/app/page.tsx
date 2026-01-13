import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
import { MainFooter } from "./_components/main-footer";
import { BioInsightHeroSection } from "./_components/bioinsight-hero-section";
// import { BioInsightFeaturesSection } from "./_components/bioinsight-features-section"; // 삭제: 내용 중복
import { BioInsightSocialProofSection } from "./_components/bioinsight-social-proof-section";
import dynamic from "next/dynamic";

// Lazy load below-the-fold sections for better initial page load
// const BetaBannerSection = dynamic(() => import("./_components/beta-banner-section").then((mod) => ({ default: mod.BetaBannerSection })), {
//   loading: () => <div className="h-16 w-full" />,
// });
// const KeyValueSection = dynamic(() => import("./_components/key-value-section").then((mod) => ({ default: mod.KeyValueSection })), {
//   loading: () => <div className="h-64 w-full bg-slate-50" />,
// });
// const ComparisonSection = dynamic(() => import("./_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })), {
//   loading: () => <div className="h-96 w-full bg-slate-50" />,
// });
const FlowSection = dynamic(() => import("./_components/flow-section").then((mod) => ({ default: mod.FlowSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
// const SafetyRegulationTeaserSection = dynamic(() => import("./_components/safety-regulation-teaser-section").then((mod) => ({ default: mod.SafetyRegulationTeaserSection })), {
//   loading: () => <div className="h-64 w-full bg-slate-50" />,
// });
const FeaturesShowcaseSection = dynamic(() => import("./_components/features-showcase-section").then((mod) => ({ default: mod.FeaturesShowcaseSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
// const PersonaSection = dynamic(() => import("./_components/persona-section").then((mod) => ({ default: mod.PersonaSection })), {
//   loading: () => <div className="h-96 w-full bg-slate-50" />,
// });
// const AISection = dynamic(() => import("./_components/ai-section").then((mod) => ({ default: mod.AISection })), {
//   loading: () => <div className="h-64 w-full bg-slate-50" />,
// });
// const SecuritySection = dynamic(() => import("./_components/security-section").then((mod) => ({ default: mod.SecuritySection })), {
//   loading: () => <div className="h-64 w-full bg-slate-50" />,
// });
// const PricingSection = dynamic(() => import("./_components/pricing-section").then((mod) => ({ default: mod.PricingSection })), {
//   loading: () => <div className="h-96 w-full bg-slate-50" />,
// });
const FinalCTASection = dynamic(() => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});

export default function HomePage() {
  return (
    <MainLayout>
      <MainHeader />
      {/* 전체 레이아웃 컨테이너 */}
      <div className="w-full">
        {/* 1. HeroSection: 검색 엔진 스타일 */}
        <BioInsightHeroSection />
        
        {/* 2. SocialProof: 신뢰도 확보 (히어로 바로 밑) */}
        <BioInsightSocialProofSection />
        
        {/* 3. KeyFeatures: AI 기반 초고속 소싱, 간편한 견적, 자동화된 관리 */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <FeaturesShowcaseSection />
        </div>
        
        {/* 4. ProcessSection: 3단계 프로세스 (검색 -> 비교 -> 견적) */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <FlowSection />
        </div>
        
        {/* 5. CTASection: "지금 바로 시작하세요" 버튼 */}
        <FinalCTASection />
        
        {/* 제거된 섹션들 (주석 처리) */}
        {/* 
        <BioInsightFeaturesSection /> // 삭제: "연구에만 집중하세요" - FeaturesShowcaseSection과 중복
        <ComparisonSection /> // 삭제: "작업 방식 비교" 테이블
        <KeyValueSection /> // 제거: 자잘한 기능 목록
        <SafetyRegulationTeaserSection /> // 제거
        <PersonaSection /> // 삭제: "누가 쓰나요?" - 너무 길음
        <AISection /> // 제거
        <SecuritySection /> // 삭제: 보안 관련 내용
        <PricingSection /> // 제거
        */}
      </div>
      <MainFooter />
    </MainLayout>
  );
}
