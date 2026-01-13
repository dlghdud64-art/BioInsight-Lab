import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import { BioInsightFeaturesSection } from "../_components/bioinsight-features-section";
import dynamic from "next/dynamic";

// Lazy load sections for better initial page load
const PersonaSection = dynamic(() => import("../_components/persona-section").then((mod) => ({ default: mod.PersonaSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const ComparisonSection = dynamic(() => import("../_components/comparison-section").then((mod) => ({ default: mod.ComparisonSection })), {
  loading: () => <div className="h-96 w-full bg-slate-50" />,
});
const SecuritySection = dynamic(() => import("../_components/security-section").then((mod) => ({ default: mod.SecuritySection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});
const FinalCTASection = dynamic(() => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })), {
  loading: () => <div className="h-64 w-full bg-slate-50" />,
});

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      {/* 전체 레이아웃 컨테이너 */}
      <div className="w-full">
        {/* 1. Intro Hero: "왜 BioInsight인가?" */}
        <section className="py-24 md:py-32 bg-slate-900 text-white">
          <div className="mx-auto max-w-4xl px-4 md:px-6 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              왜 BioInsight인가?
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              연구실 재고 관리와 구매 프로세스를 한 곳에서 통합 관리하세요.
              <br />
              복잡한 엑셀과 수기 기록은 이제 그만, AI 기반 스마트 솔루션으로 연구에만 집중하세요.
            </p>
          </div>
        </section>

        {/* 2. UserPersona: "누가 쓰나요?" */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <PersonaSection />
        </div>

        {/* 3. FeatureGrid: "연구에만 집중하세요" */}
        <BioInsightFeaturesSection />

        {/* 4. ComparisonTable: "작업 방식 비교" */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <ComparisonSection />
        </div>

        {/* 5. SecuritySection: "강력한 보안" */}
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <SecuritySection />
        </div>

        {/* 6. CTASection: "지금 시작하기" */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}

