import { Beaker, ShoppingCart, ClipboardList, Shield } from "lucide-react";

const ROLES = [
  {
    icon: Beaker,
    role: "연구원",
    tagline: "검색과 비교에 쓰는 시간을 줄이고, 실험에 집중",
    items: [
      "시약·장비를 글로벌 공급사에서 한 번에 검색",
      "대체품 비교 결과를 저장하고 다음 구매에 재활용",
      "견적 요청을 직접 발송하고 응답 상태를 추적",
      "입고된 시약의 Lot·유효기한을 실험 전 확인",
    ],
  },
  {
    icon: ShoppingCart,
    role: "구매 담당자",
    tagline: "반복 구매의 흐름을 체계화하고, 병목을 제거",
    items: [
      "견적 수신 → 비교 → 승인 → 발주 전환을 한 흐름에서 처리",
      "벤더별 단가·리드타임 이력으로 구매 판단 근거 확보",
      "승인 대기·지연 건을 대시보드에서 즉시 파악",
      "구매 후 입고까지의 상태를 자동 추적",
    ],
  },
  {
    icon: ClipboardList,
    role: "랩 매니저",
    tagline: "재고 리스크를 사전에 감지하고, 운영 안정성 확보",
    items: [
      "부족 재고·만료 임박 품목을 한 화면에서 확인",
      "재주문 후보를 자동 생성하고 발주까지 연결",
      "팀원별 구매 현황과 처리 대기 작업을 조율",
      "보관 위치·Lot 추적으로 실험실 운영 효율 향상",
    ],
  },
  {
    icon: Shield,
    role: "조직 관리자",
    tagline: "구매 이력과 권한 체계를 한 곳에서 통제",
    items: [
      "구매 승인 흐름과 예산 한도를 조직 정책에 맞게 설정",
      "팀별·프로젝트별 지출 추이를 분석하고 예산 초과를 사전 감지",
      "구매 이력·감사 증적을 자동 기록하고 내보내기",
      "멤버 권한(열람/요청/승인/관리)을 역할별로 통제",
    ],
  },
];

export function RoleValueSection() {
  return (
    <section className="py-16 md:py-24 bg-[#070a0e] border-t border-[#1a1e24]">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-3">
            Value by Role
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-tight break-keep">
            역할마다 빨라지는 업무,
            <br />역할마다 통제되는 운영
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.role}
                className="bg-[#121619] border border-[#1e2228] rounded-md p-4 md:p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-md bg-[#181c22] border border-[#1e2228] flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-[#9ca3af]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{r.role}</h3>
                    <p className="text-xs text-[#6b7280]">{r.tagline}</p>
                  </div>
                </div>
                <ul className="space-y-2 mt-3">
                  {r.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#4b5563] mt-1.5 flex-shrink-0" />
                      <span className="text-xs text-[#9ca3af] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
