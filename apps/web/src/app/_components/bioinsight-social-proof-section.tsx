"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Product Architecture Strip ────────────────────────────────────
 *  Role: 제품 구조를 한 눈에 인지시키는 구간 (supporting layer)
 *  Layout: 1줄 제목 + 3 token strip (no paragraph, no body copy)
 * ────────────────────────────────────────────────────────────────────
 */

const FRAMES = [
  {
    stage: "SOURCING & COMPARE",
    tokens: ["후보 구조화", "delta 판단", "shortlist"],
  },
  {
    stage: "REQUEST & PO HANDOFF",
    tokens: ["요청 생성", "선택안 확정", "발주 준비"],
  },
  {
    stage: "RECEIVE & STOCK",
    tokens: ["입고 반영", "lot 관리", "재주문"],
  },
];

export function BioInsightSocialProofSection() {
  return (
    <section
      style={{
        backgroundColor: "#0B1E35",
        borderTop: "1px solid #1E3050",
        borderBottom: "1px solid #1E3050",
      }}
    >
      <div className="max-w-[1100px] mx-auto px-4 py-10 md:py-12">
        {/* 1줄 제목 */}
        <h2 className="text-base md:text-lg font-bold text-white tracking-tight mb-6 md:mb-8">
          검색부터 재고까지, 운영 체인 전체를 연결합니다
        </h2>

        {/* 3 token strips — inline, compact */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          {FRAMES.map((frame, idx) => (
            <div
              key={frame.stage}
              className="flex-1 rounded-lg px-4 py-3 flex items-center gap-3"
              style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
            >
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
                style={{ backgroundColor: "#142840", color: "#60A5FA" }}
              >
                {frame.stage}
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {frame.tokens.map((token, ti) => (
                  <span key={token} className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{ backgroundColor: "#0D1E35", color: "#8A99AF", border: "1px solid #1A2D48" }}
                    >
                      {token}
                    </span>
                    {ti < frame.tokens.length - 1 && (
                      <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#2A4060" }} />
                    )}
                  </span>
                ))}
              </div>
              {idx < FRAMES.length - 1 && (
                <ArrowRight className="h-3 w-3 flex-shrink-0 hidden md:block" style={{ color: "#3A5068" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
