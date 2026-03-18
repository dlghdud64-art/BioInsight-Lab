import {
  AlertTriangle, Clock, GitCompare, Package, ShieldCheck, Users,
} from "lucide-react";

const EVIDENCE_ITEMS = [
  {
    icon: AlertTriangle,
    title: "부족 품목을 늦기 전에 파악",
    description: "안전재고 기준 대비 현재 수량을 실시간으로 추적하고, 부족 품목이 발생하면 즉시 재주문 후보로 연결합니다.",
    metric: "안전재고 미달 → 재주문 제안",
    color: "text-red-400",
  },
  {
    icon: Clock,
    title: "만료 임박 lot 추적",
    description: "입고된 시약의 Lot 번호와 유효기한을 기록하고, 만료 7일·30일 전 경고를 통해 폐기 리스크를 줄입니다.",
    metric: "D-7 / D-30 만료 경고",
    color: "text-amber-400",
  },
  {
    icon: GitCompare,
    title: "벤더 비교와 견적 추적 연결",
    description: "같은 품목의 벤더별 가격·리드타임 비교 결과가 견적 요청까지 이어지고, 이전 비교 이력도 함께 보여줍니다.",
    metric: "비교 → 견적 → 발주 연결",
    color: "text-blue-400",
  },
  {
    icon: Package,
    title: "구매 이후 재고 운영까지 연결",
    description: "발주 확정 후 입고 등록, 수량 반영, 보관 위치 지정까지 하나의 흐름으로 처리합니다.",
    metric: "발주 → 입고 → 재고 자동 연결",
    color: "text-emerald-400",
  },
  {
    icon: ShieldCheck,
    title: "승인·예산·안전 기준을 함께 확인",
    description: "구매 승인 흐름, 예산 한도, MSDS 관련 안전 정보가 구매 과정 안에서 함께 확인됩니다.",
    metric: "승인 + 예산 + 안전 통합 확인",
    color: "text-violet-400",
  },
  {
    icon: Users,
    title: "팀 단위 운영 상태를 한 화면에서 확인",
    description: "팀원별 구매 현황, 재고 상태, 처리 대기 작업을 한 대시보드에서 확인하고 조율합니다.",
    metric: "팀 운영 현황 통합 대시보드",
    color: "text-teal-400",
  },
];

export function OpsEvidenceSection() {
  return (
    <section className="py-16 md:py-24 bg-sh border-t border-bd">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-3">
            Operational Evidence
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-tight break-keep">
            기능을 보여주는 것이 아니라,
            <br />운영이 안정되는 증거를 보여줍니다
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EVIDENCE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-pg border border-bd rounded-md p-4 hover:border-[#2a2e35] transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-md bg-pn border border-bd flex items-center justify-center flex-shrink-0">
                    <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                </div>
                <p className="text-xs text-[#9ca3af] leading-relaxed mb-3">{item.description}</p>
                <div className="border-t border-bd pt-2.5">
                  <p className="text-[10px] font-medium text-[#6b7280] uppercase tracking-wider">{item.metric}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
