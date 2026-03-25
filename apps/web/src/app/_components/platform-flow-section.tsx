"use client";

import { ArrowRight } from "lucide-react";

const COMPARISON_ROWS = [
  {
    step: "1. 검색",
    before: "벤더 사이트를 개별 방문하고 수기로 후보를 정리",
    after: "통합 검색으로 후보를 한 화면에서 바로 비교",
  },
  {
    step: "2. 비교",
    before: "엑셀에서 수기로 스펙·가격을 정리, 팀 공유 불가",
    after: "비교 워크스페이스에서 팀 단위 실시간 판단",
  },
  {
    step: "3. 견적 요청",
    before: "벤더별 양식과 이메일로 개별 요청, 회신 추적 불가",
    after: "비교 결과에서 바로 견적 요청서 생성·전송",
  },
  {
    step: "4. 발주",
    before: "승인 프로세스가 구두·문서 기반, 누락 빈번",
    after: "승인 라인 → 발주 전환까지 한 흐름으로 연결",
  },
  {
    step: "5. 입고",
    before: "입고 확인을 수기로 처리, 수량·Lot 누락 가능",
    after: "입고 시 자동 반영, 부분 입고·이슈 즉시 처리",
  },
  {
    step: "6. 재고 운영",
    before: "구매 후 재고 수동 등록, Lot·유효기간 관리 어려움",
    after: "요청–발주–입고–재고 이력이 하나로 연결",
  },
];

export function PlatformFlowSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: "#10151C", borderBottom: "1px solid #232C3A" }}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-6">
        <div className="mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6FA2FF] mb-2">
            Operational Value
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-[#F3F7FF] tracking-tight mb-2">
            각 단계에서 무엇이 달라지는가
          </h2>
          <p className="text-xs md:text-sm text-[#BAC6D9] max-w-lg">
            6단계 운영 파이프라인에서 기존 방식의 병목이 어떻게 해소되는지 보여드립니다.
          </p>
        </div>

        {/* Decision table header */}
        <div className="hidden md:grid md:grid-cols-[140px_1fr_40px_1fr] items-center px-5 py-2.5 mb-2 rounded-t-lg" style={{ backgroundColor: "#1A2029" }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8794AA]">단계</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#667389]">기존 방식</span>
          <span />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A94FF]">LABAXIS 도입 후</span>
        </div>

        {/* Decision rows */}
        <div className="space-y-1">
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.step}
              className="rounded-lg p-4 md:p-0 md:grid md:grid-cols-[140px_1fr_40px_1fr] md:items-center transition-colors"
              style={{ backgroundColor: "#1A2029", border: "1px solid #303A4A" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#1F2631"; e.currentTarget.style.borderColor = "#3A4A60"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#1A2029"; e.currentTarget.style.borderColor = "#303A4A"; }}
            >
              {/* Step */}
              <div className="md:px-5 md:py-4">
                <span className="text-sm font-bold text-[#F3F7FF]">{row.step}</span>
              </div>

              {/* Before — muted */}
              <div className="md:px-4 md:py-4 mt-2 md:mt-0">
                <p className="text-xs text-[#667389] leading-relaxed">{row.before}</p>
              </div>

              {/* Arrow */}
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-[#354459]" />
              </div>

              {/* After — strong payoff */}
              <div className="md:px-4 md:py-4 mt-2 md:mt-0 md:rounded-r-lg" style={{ backgroundColor: "rgba(90,148,255,0.04)" }}>
                <p className="text-xs text-[#F3F7FF] font-medium leading-relaxed">
                  <span className="text-[#5A94FF] font-semibold">LabAxis</span>{" "}{row.after}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
