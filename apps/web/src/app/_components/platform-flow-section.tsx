"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Operating Delta Proof ──────────────────────────────────────────
 *  Role: 병목 → 해결, 한 줄 매트릭스
 *  5행, 한 행당 텍스트 1줄만
 * ────────────────────────────────────────────────────────────────────
 */

const DELTA_ROWS = [
  { step: "검색", before: "분산 검색, 후보 정리 30분+", after: "후보군 즉시 구조화" },
  { step: "비교", before: "수기 표 정리, 판단 지연", after: "delta 판단 후 shortlist" },
  { step: "요청", before: "handoff 분리, 재정리 필요", after: "선택 결과로 요청 생성" },
  { step: "발주", before: "이력 분산, 누락·지연", after: "선택안 기준 PO 준비" },
  { step: "입고·재고", before: "기록 분리, 사각지대", after: "입고 즉시 stock 반영" },
];

export function PlatformFlowSection() {
  return (
    <section className="py-10 md:py-14" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #1E3050" }}>
      <div className="max-w-[1000px] mx-auto px-4 md:px-6">
        <div className="mb-5 md:mb-7">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#60A5FA" }}>
            Operational Delta
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
            각 단계에서 달라지는 운영 방식
          </h2>
        </div>

        {/* Desktop: compact delta matrix */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_28px_1fr] items-center px-4 py-2 mb-1 rounded-t-lg" style={{ backgroundColor: "#142840" }}>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>단계</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>기존 병목</span>
            <span />
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#60A5FA" }}>LabAxis</span>
          </div>

          {/* Rows */}
          {DELTA_ROWS.map((row, i) => (
            <div
              key={row.step}
              className="grid grid-cols-[80px_1fr_28px_1fr] items-center"
              style={{
                backgroundColor: i % 2 === 0 ? "#0A1828" : "#0D1E35",
                borderBottom: i < DELTA_ROWS.length - 1 ? "1px solid #162A42" : undefined,
                borderRadius: i === DELTA_ROWS.length - 1 ? "0 0 8px 8px" : undefined,
              }}
            >
              <div className="px-4 py-2.5">
                <span className="text-[11px] font-bold text-white">{row.step}</span>
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[11px]" style={{ color: "#5A6A7E", textDecoration: "line-through", textDecorationColor: "#3A4A5E" }}>{row.before}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-3 w-3" style={{ color: "#3A5068" }} />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[12px] font-medium" style={{ color: "#C8D4E5" }}>{row.after}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: stacked compact */}
        <div className="md:hidden space-y-1.5">
          {DELTA_ROWS.map((row) => (
            <div key={row.step} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "#142840", color: "#60A5FA" }}>{row.step}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]" style={{ color: "#5A6A7E", textDecoration: "line-through", textDecorationColor: "#3A4A5E" }}>{row.before}</span>
                <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#3A5068" }} />
                <span className="text-[11px] font-medium" style={{ color: "#C8D4E5" }}>{row.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
