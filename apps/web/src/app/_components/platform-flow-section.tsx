import {
  Search, GitCompare, FileText, ShieldCheck, Package,
  ArrowRight,
} from "lucide-react";

const OPS_VALUES = [
  {
    icon: Search,
    title: "벤더 분산 제거",
    before: "벤더 사이트 6~10곳 반복 검색, 건당 30분 이상",
    after: "통합 검색으로 즉시 비교 가능한 후보 리스트 확보",
  },
  {
    icon: GitCompare,
    title: "판단 속도 향상",
    before: "엑셀에서 수기로 스펙·가격 정리, 공유 불가",
    after: "비교 워크스페이스에서 팀 단위 실시간 판단",
  },
  {
    icon: FileText,
    title: "커뮤니케이션 구조화",
    before: "이메일로 견적 요청, 회신 추적 불가",
    after: "구조화된 견적 요청·회신·비교, SLA 자동 추적",
  },
  {
    icon: ShieldCheck,
    title: "상태 추적 강화",
    before: "승인·발주·입고를 별도 관리, 빈번한 누락",
    after: "승인 → 발주 → 입고 → 재고 자동 연결, 상태 실시간 추적",
  },
  {
    icon: Package,
    title: "재고 운영 연동",
    before: "구매 완료 후 재고 수동 등록, Lot·유효기간 관리 어려움",
    after: "입고 시 재고 자동 반영, 만료·부족 선제 대응",
  },
];

export function PlatformFlowSection() {
  return (
    <section className="py-14 md:py-20 bg-pg border-b border-bs">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="mb-10 md:mb-14">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Operational Value
          </p>
          <h2 className="text-lg md:text-2xl font-bold text-slate-100 tracking-tight mb-1">
            각 단계에서 무엇이 달라지는가
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl">
            기존 방식의 병목을 LabAxis가 어떻게 해소하는지 단계별로 보여드립니다.
          </p>
        </div>

        {/* Value Cards */}
        <div className="space-y-3 md:space-y-4">
          {OPS_VALUES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-pn border border-bd rounded-lg p-4 md:p-5 hover:bg-el/40 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <Icon className="h-5 w-5 text-slate-400" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm md:text-base font-semibold text-slate-100 mb-2">
                      {item.title}
                    </h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          <span className="text-slate-500 font-medium">기존</span>{" "}
                          {item.before}
                        </p>
                      </div>
                      <ArrowRight className="hidden md:block h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <span className="text-blue-400 font-medium">LabAxis</span>{" "}
                          {item.after}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
