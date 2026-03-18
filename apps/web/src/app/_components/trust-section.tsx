import { History, FlaskConical, Lock, Download, Users } from "lucide-react";

const TRUST_ITEMS = [
  {
    icon: History,
    title: "구매 이력 추적",
    description: "모든 견적·발주·입고 기록이 자동으로 저장되고, 감사 증적으로 활용할 수 있습니다.",
  },
  {
    icon: FlaskConical,
    title: "Lot·유효기간 관리",
    description: "입고 시 Lot 번호와 유효기한을 기록하고, 만료 임박 품목을 사전에 알려줍니다.",
  },
  {
    icon: Lock,
    title: "권한·승인 흐름",
    description: "역할별 권한(열람/요청/승인/관리)과 구매 승인 프로세스를 조직 정책에 맞게 설정합니다.",
  },
  {
    icon: Download,
    title: "데이터 내보내기",
    description: "구매 이력, 재고 현황, 지출 분석 데이터를 CSV/Excel로 내보내고 외부 시스템과 연계합니다.",
  },
  {
    icon: Users,
    title: "팀 단위 운영 허브",
    description: "팀·워크스페이스 단위로 구매 운영을 분리하고, 멤버별 업무 현황을 한 화면에서 확인합니다.",
  },
];

export function TrustSection() {
  return (
    <section className="py-16 md:py-24 bg-sh border-t border-bd">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4b5563] mb-3">
            Operational Trust
          </p>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight leading-tight break-keep">
            운영의 신뢰는 기능이 아니라
            <br />체계에서 나옵니다
          </h2>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-bd rounded-md overflow-hidden">
            {TRUST_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isLast = idx === TRUST_ITEMS.length - 1;
              return (
                <div
                  key={item.title}
                  className={`p-4 md:p-5 bg-pg ${!isLast ? "border-b md:border-b lg:border-b-0 lg:border-r border-bd" : ""} ${idx === 3 ? "lg:border-b lg:border-r" : ""} ${idx === 4 ? "lg:col-span-1" : ""}`}
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-7 h-7 rounded-md bg-pn border border-bd flex items-center justify-center flex-shrink-0">
                      <Icon className="h-3.5 w-3.5 text-[#9ca3af]" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                  </div>
                  <p className="text-xs text-[#9ca3af] leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
