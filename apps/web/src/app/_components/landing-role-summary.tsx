import { Beaker, ShoppingCart, ClipboardList, Shield } from "lucide-react";

const ROLES = [
  {
    icon: Beaker,
    role: "연구원",
    benefit: "통합 검색 + 비교표 자동 생성으로 시약 선정 시간 단축",
    color: "text-amber-400",
  },
  {
    icon: ShoppingCart,
    role: "구매 담당자",
    benefit: "견적 수집 → 비교 → 승인 → 발주를 한 흐름에서 처리",
    color: "text-blue-400",
  },
  {
    icon: ClipboardList,
    role: "랩 매니저",
    benefit: "부족 재고·만료 임박 품목 감지 + 재주문 자동 연결",
    color: "text-teal-400",
  },
  {
    icon: Shield,
    role: "조직 관리자",
    benefit: "구매 이력·권한·예산을 한 곳에서 통제하고 감사 대비",
    color: "text-violet-400",
  },
];

export function LandingRoleSummary() {
  return (
    <section className="py-14 md:py-20 bg-sh border-t border-bd">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-4">
            Value by Role
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-[1.4] break-keep">
            역할마다 빠르게 시작하고,
            <br />역할마다 확실하게 통제합니다
          </h2>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.role}
                className="bg-pg border border-bd rounded-md p-4 flex items-start gap-3 hover:border-[#2a2e35] transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-pn border border-bd flex items-center justify-center flex-shrink-0">
                  <Icon className={`h-4 w-4 ${r.color}`} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-100 mb-1">{r.role}</h3>
                  <p className="text-xs text-[#9ca3af] leading-relaxed break-keep">{r.benefit}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-[#6b7280] hover:text-blue-400 transition-colors">
            역할별 상세 가치 보기 →
          </a>
        </div>
      </div>
    </section>
  );
}
