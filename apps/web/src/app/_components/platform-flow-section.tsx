"use client";

import {
  Search, GitCompare, FileText, ShieldCheck, Package,
  ArrowRight,
} from "lucide-react";

const OPS_VALUES = [
  {
    icon: Search,
    title: "벤더 분산 제거",
    before: "벤더 사이트 6~10곳 반복 검색, 건당 30분 이상",
    after: "비교 가능한 후보 리스트를 즉시 정리",
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
    after: "입찰·견적 상태와 SLA를 연결 추적",
  },
  {
    icon: ShieldCheck,
    title: "상태 추적 강화",
    before: "승인·발주·입고를 별도 관리, 빈번한 누락",
    after: "승인 → 발주 → 입고 → 재고 상태 실시간 연결",
  },
  {
    icon: Package,
    title: "재고 운영 연동",
    before: "구매 완료 후 재고 수동 등록, Lot·유효기간 누락",
    after: "입고와 재고 위험을 같은 흐름에서 반영",
  },
];

export function PlatformFlowSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: "#0A121C", borderBottom: "1px solid #1E2D40" }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6FA2FF] mb-2">
            Operational Value
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-[#F3F7FF] tracking-tight mb-2">
            각 단계에서 무엇이 달라지는가
          </h2>
          <p className="text-xs md:text-sm text-[#BAC6D9] max-w-lg">
            기존 방식의 병목을 LabAxis 운영 파이프라인이 어떻게 해소하는지 보여드립니다.
          </p>
        </div>

        <div className="space-y-3">
          {OPS_VALUES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-lg p-4 md:p-5 transition-colors"
                style={{ backgroundColor: "#131C28", border: "1px solid #26364C" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#172232"; e.currentTarget.style.borderColor = "#31506F"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#131C28"; e.currentTarget.style.borderColor = "#26364C"; }}
              >
                <div className="flex items-start gap-4">
                  <Icon className="h-4 w-4 text-[#8794AA] flex-shrink-0 mt-1" strokeWidth={1.8} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[#F3F7FF] mb-2">{item.title}</h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-[#7F8CA3] leading-relaxed">
                          <span className="font-medium">기존</span> {item.before}
                        </p>
                      </div>
                      <ArrowRight className="hidden md:block h-3 w-3 text-[#26364C] flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-[#BAC6D9] leading-relaxed">
                          <span className="text-[#5A94FF] font-medium">LabAxis</span> {item.after}
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
