import { MainLayout } from "./_components/main-layout";
import { MainHeader } from "./_components/main-header";
import { MainFooter } from "./_components/main-footer";
import { LabAxisHeroSection } from "./_components/bioinsight-hero-section";
import dynamic from "next/dynamic";

const OpsFlowSection = dynamic(
  () => import("./_components/ops-flow-section").then((mod) => ({ default: mod.OpsFlowSection })),
  { loading: () => <div className="h-96 w-full bg-[#070a0e]" /> }
);

const OpsEvidenceSection = dynamic(
  () => import("./_components/ops-evidence-section").then((mod) => ({ default: mod.OpsEvidenceSection })),
  { loading: () => <div className="h-64 w-full bg-[#0a0d11]" /> }
);

const RoleValueSection = dynamic(
  () => import("./_components/role-value-section").then((mod) => ({ default: mod.RoleValueSection })),
  { loading: () => <div className="h-64 w-full bg-[#070a0e]" /> }
);

const TrustSection = dynamic(
  () => import("./_components/trust-section").then((mod) => ({ default: mod.TrustSection })),
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
        {/* A. Hero: 운영 가치 제안 + 운영 패널 조합 + 파이프라인 */}
        <LabAxisHeroSection />

        {/* B. 운영 흐름: 4단계 검색→비교→견적→입고/재고 (입력/판단/액션/결과) */}
        <OpsFlowSection />

        {/* C. 운영 증거: 운영이 안정되는 6가지 증거 */}
        <OpsEvidenceSection />

        {/* D. 역할별 가치: 연구원/구매담당/랩매니저/조직관리자 */}
        <RoleValueSection />

        {/* E. 도입 신뢰: 이력추적/Lot관리/권한/내보내기/팀허브 */}
        <TrustSection />

        {/* F. 하단 CTA */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
