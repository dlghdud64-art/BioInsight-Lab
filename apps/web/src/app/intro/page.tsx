import { MainLayout } from "../_components/main-layout";
import { MainHeader } from "../_components/main-header";
import { MainFooter } from "../_components/main-footer";
import dynamic from "next/dynamic";

const OpsFlowSection = dynamic(
  () => import("../_components/ops-flow-section").then((mod) => ({ default: mod.OpsFlowSection })),
  { loading: () => <div className="h-96 w-full bg-[#09090b]" /> }
);

const OpsEvidenceSection = dynamic(
  () => import("../_components/ops-evidence-section").then((mod) => ({ default: mod.OpsEvidenceSection })),
  { loading: () => <div className="h-64 w-full bg-[#0c0c0f]" /> }
);

const RoleValueSection = dynamic(
  () => import("../_components/role-value-section").then((mod) => ({ default: mod.RoleValueSection })),
  { loading: () => <div className="h-64 w-full bg-[#09090b]" /> }
);

const TrustSection = dynamic(
  () => import("../_components/trust-section").then((mod) => ({ default: mod.TrustSection })),
  { loading: () => <div className="h-64 w-full bg-[#0c0c0f]" /> }
);

const FinalCTASection = dynamic(
  () => import("../_components/final-cta-section").then((mod) => ({ default: mod.FinalCTASection })),
  { loading: () => <div className="h-64 w-full bg-[#09090b]" /> }
);

export default function IntroPage() {
  return (
    <MainLayout>
      <MainHeader />
      <div className="w-full">
        {/* Intro Hero — 간결한 도입 */}
        <section className="pt-28 md:pt-36 pb-10 md:pb-14 bg-[#09090b] border-b border-[#1e1e23]">
          <div className="container px-4 md:px-6 mx-auto text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400 mb-3">
              제품 소개
            </p>
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-slate-100 tracking-tight leading-tight break-keep mb-4">
              검색부터 비교, 견적, 발주,
              <br />입고, 재고 운영까지 — 하나의 흐름
            </h1>
            <p className="text-sm md:text-base text-[#9ca3af] max-w-xl mx-auto leading-relaxed break-keep">
              LabAxis의 운영 파이프라인이 연구 구매의 전 과정을 어떻게 연결하는지 확인하세요.
              각 단계에서 무엇이 입력되고, 어떤 판단이 이루어지며, 어떤 액션으로 이어지는지 보여드립니다.
            </p>
          </div>
        </section>

        {/* A. 운영 흐름 4단계: 검색→비교→견적→입고/재고 */}
        <OpsFlowSection />

        {/* B. 운영 증거: 운영이 안정되는 6가지 증거 */}
        <OpsEvidenceSection />

        {/* C. 역할별 가치: 연구원/구매담당/랩매니저/조직관리자 */}
        <RoleValueSection />

        {/* D. 도입 신뢰: 이력추적/Lot관리/권한/내보내기/팀허브 */}
        <TrustSection />

        {/* E. 하단 CTA */}
        <FinalCTASection />
      </div>
      <MainFooter />
    </MainLayout>
  );
}
