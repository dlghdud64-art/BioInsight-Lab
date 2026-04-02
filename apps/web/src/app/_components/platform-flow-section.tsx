"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Operating Delta Proof ──────────────────────────────────────────
 *  Role: 각 단계의 "기존 병목 → LabAxis 해소 → 다음 단계 연결"을 증명
 *  Tone: dark content surface — capability band와 동일 제품군
 *  Column: 단계 / 핵심 / 기존 방식의 병목 / LabAxis에서 바로 바뀌는 점
 *  읽기 방향: 병목 인지 → 해소 확인 → 다음 단계 연결 납득
 * ────────────────────────────────────────────────────────────────────
 */

const DELTA_ROWS = [
  { step: "검색",  tag: "병목 제거",     before: "여러 사이트를 개별 확인, 후보 정리까지 30분+",     after: "비교 가능한 후보군으로 바로 구조화" },
  { step: "비교",  tag: "판단 속도",     before: "수기로 표 정리, 팀 공유 불가 → 판단 지연",         after: "delta-first 판단면에서 즉시 shortlist" },
  { step: "견적",  tag: "handoff 제거",  before: "메신저·메일로 재정리 후 개별 요청",                after: "선택 결과에서 바로 요청 객체 생성" },
  { step: "발주",  tag: "흐름 연결",     before: "승인과 이력 분리, 누락·지연 빈번",                after: "요청–승인–발주 흐름이 하나로 연결" },
  { step: "입고",  tag: "truth 반영",    before: "입고와 lot 추적 분리, 수량 누락",                 after: "입고 확인 즉시 재고·lot 반영" },
  { step: "재고",  tag: "이력 연결",     before: "구매 기록과 재고 기록 분리, 사각지대",             after: "요청–발주–입고–재고 이력 하나로 연결" },
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
            각 단계에서 실제로 달라지는 운영 방식
          </h2>
          <p className="text-[11px] md:text-xs max-w-2xl" style={{ color: "#6A7A8E" }}>
            기존 방식의 병목은 검색, 비교, 요청, 입고가 서로 분리되어 있다는 점입니다. LabAxis는 각 단계를 하나의 운영 흐름으로 연결합니다.
          </p>
        </div>

        {/* Desktop: delta matrix */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="grid grid-cols-[64px_72px_1fr_28px_1fr] items-center px-4 py-2 mb-1 rounded-t-lg" style={{ backgroundColor: "#142840" }}>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>단계</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>핵심</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>기존 방식의 병목</span>
            <span />
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#60A5FA" }}>LabAxis에서 바로 바뀌는 점</span>
          </div>

          {/* Rows */}
          {DELTA_ROWS.map((row, i) => (
            <div
              key={row.step}
              className="grid grid-cols-[64px_72px_1fr_28px_1fr] items-center group transition-colors"
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

              {/* Tag — what this delta achieves */}
              <div className="py-3">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#142840", color: "#60A5FA" }}>{row.tag}</span>
              </div>

              {/* Before — muted, subdued */}
              <div className="px-3 py-3">
                <p className="text-[11px] leading-relaxed" style={{ color: "#5A6A7E", textDecoration: "line-through", textDecorationColor: "#3A4A5E" }}>{row.before}</p>
              </div>

              {/* Arrow — delta indicator */}
              <div className="flex items-center justify-center">
                <ArrowRight className="h-3 w-3" style={{ color: "#3A5068" }} />
              </div>

              {/* After — clear, strong */}
              <div className="px-3 py-3">
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
                <span className="text-[9px] font-semibold" style={{ color: "#4A5E78" }}>{row.tag}</span>
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
