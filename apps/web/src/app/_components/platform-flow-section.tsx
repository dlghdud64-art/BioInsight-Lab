"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Proof Surface: Operational Delta Matrix ─────────────────────────
 *  Role: "기존 방식 vs LabAxis"를 증거 표면으로 제시
 *  Tone: dark content surface — hero와 같은 제품군
 *  Style: 비교표가 아닌 structured delta proof
 *  기존 방식 = muted/subdued, LabAxis = 선명/강조
 * ────────────────────────────────────────────────────────────────────
 */

const DELTA_ROWS = [
  { step: "검색",    before: "벤더 10곳 개별 방문, 수기 후보 정리",           after: "통합 검색 → 한 화면에서 후보 비교" },
  { step: "비교",    before: "엑셀 수기 스펙·가격 정리, 팀 공유 불가",       after: "비교 워크스페이스에서 팀 단위 실시간 판단" },
  { step: "견적",    before: "벤더별 양식·이메일 개별 요청, 회신 추적 불가",  after: "비교 결과에서 바로 견적 요청 생성·전송" },
  { step: "발주",    before: "승인 프로세스 구두·문서 기반, 누락 빈번",       after: "승인 라인 → 발주 전환까지 한 흐름 연결" },
  { step: "입고",    before: "입고 확인 수기 처리, 수량·Lot 누락",            after: "입고 즉시 반영, 부분 입고·이슈 처리" },
  { step: "재고",    before: "구매 후 수동 등록, Lot·유효기간 관리 어려움",    after: "요청–발주–입고–재고 이력 하나로 연결" },
];

export function PlatformFlowSection() {
  return (
    <section className="py-12 md:py-16" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #1E3050" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        <div className="mb-6 md:mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#60A5FA" }}>
            Operational Delta
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-1.5">
            각 단계에서 무엇이 달라지는가
          </h2>
          <p className="text-[11px] md:text-xs max-w-lg" style={{ color: "#6A7A8E" }}>
            6단계 운영 파이프라인의 기존 병목이 어떻게 해소되는지.
          </p>
        </div>

        {/* Desktop: delta matrix */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_32px_1fr] items-center px-4 py-2 mb-1 rounded-t-lg" style={{ backgroundColor: "#142840" }}>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>단계</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>기존 방식</span>
            <span />
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#60A5FA" }}>LabAxis</span>
          </div>

          {/* Rows */}
          {DELTA_ROWS.map((row, i) => (
            <div
              key={row.step}
              className="grid grid-cols-[80px_1fr_32px_1fr] items-center group transition-colors"
              style={{
                backgroundColor: i % 2 === 0 ? "#0A1828" : "#0D1E35",
                borderBottom: i < DELTA_ROWS.length - 1 ? "1px solid #162A42" : undefined,
                borderRadius: i === DELTA_ROWS.length - 1 ? "0 0 8px 8px" : undefined,
              }}
            >
              {/* Step label */}
              <div className="px-4 py-3">
                <span className="text-[11px] font-bold text-white">{row.step}</span>
              </div>

              {/* Before — muted, subdued */}
              <div className="px-4 py-3">
                <p className="text-[11px] leading-relaxed" style={{ color: "#5A6A7E", textDecoration: "line-through", textDecorationColor: "#3A4A5E" }}>{row.before}</p>
              </div>

              {/* Arrow — delta indicator */}
              <div className="flex items-center justify-center">
                <ArrowRight className="h-3 w-3" style={{ color: "#3A5068" }} />
              </div>

              {/* After — clear, strong */}
              <div className="px-4 py-3">
                <p className="text-[12px] font-medium leading-relaxed" style={{ color: "#C8D4E5" }}>{row.after}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: stacked delta cards */}
        <div className="md:hidden space-y-2">
          {DELTA_ROWS.map((row) => (
            <div key={row.step} className="rounded-lg p-3" style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#142840", color: "#60A5FA" }}>{row.step}</span>
              </div>
              <p className="text-[10px] mb-1.5" style={{ color: "#5A6A7E", textDecoration: "line-through", textDecorationColor: "#3A4A5E" }}>{row.before}</p>
              <div className="flex items-start gap-1.5">
                <ArrowRight className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" style={{ color: "#3A5068" }} />
                <p className="text-[11px] font-medium" style={{ color: "#C8D4E5" }}>{row.after}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
