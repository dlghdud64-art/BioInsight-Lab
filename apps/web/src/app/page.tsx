import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
import { MainFooter } from "./_components/main-footer";
import dynamic from "next/dynamic";

const LandingHeroSection = dynamic(
  () => import("./_components/landing-hero-section").then((mod) => ({ default: mod.LandingHeroSection })),
  { loading: () => <div className="h-[520px] w-full bg-[#070a0e]" /> }
);

const LandingTrustBar = dynamic(
  () => import("./_components/landing-trust-bar").then((mod) => ({ default: mod.LandingTrustBar })),
  { loading: () => <div className="h-20 w-full bg-[#0a0d11]" /> }
);

const LandingProblemSolution = dynamic(
  () => import("./_components/landing-problem-solution").then((mod) => ({ default: mod.LandingProblemSolution })),
  { loading: () => <div className="h-80 w-full bg-[#070a0e]" /> }
);

const LandingRoleSummary = dynamic(
  () => import("./_components/landing-role-summary").then((mod) => ({ default: mod.LandingRoleSummary })),
  { loading: () => <div className="h-64 w-full bg-[#0a0d11]" /> }
);

const FinalCTASection = dynamic(
  () => import("./_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-[#070a0e]" /> }
);

export default function HomePage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        {/* A. Hero — 가치 제안, 핵심 CTA, 파이프라인 요약 */}
        <LandingHeroSection />

        {/* B. 신뢰 지표 바 */}
        <LandingTrustBar />

        {/* C. 핵심 문제 → 해결 */}
        <LandingProblemSolution />

        {/* D. 역할별 가치 요약 */}
        <LandingRoleSummary />

        {/* E. 하단 CTA */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
