"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Product Architecture Strip ────────────────────────────────────
 *  Role: Hero 직후, 제품 구조를 한 눈에 인지시키는 구간
 *  Layout: 3 frames — action strip + 3 tokens (no paragraph)
 *  텍스트를 읽기 전에도 운영 체인이 먼저 보여야 함
 * ────────────────────────────────────────────────────────────────────
 */

const FRAMES = [
  {
    stage: "SOURCING & COMPARE",
    title: "후보를 비교 가능한 상태로 정리합니다",
    flow: ["Search Seed", "Candidate Triage", "Compare Decision"],
    tokens: ["후보 구조화", "delta 판단", "shortlist"],
    next: "Request & PO Handoff로 연결",
  },
  {
    stage: "REQUEST & PO HANDOFF",
    title: "선택 결과를 요청과 발주 전환으로 넘깁니다",
    flow: ["Request Object", "Reply Review", "PO Ready"],
    tokens: ["요청 생성", "선택안 확정", "발주 준비"],
    next: "Receive & Stock으로 연결",
  },
  {
    stage: "RECEIVE & STOCK",
    title: "입고 이후 이력과 재고까지 이어집니다",
    flow: ["Receiving", "Lot / Expiry", "Stock Truth"],
    tokens: ["입고 반영", "lot 관리", "재주문"],
    next: "소싱 → 재구매 사이클 재진입",
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
      <div className="max-w-[1240px] mx-auto px-4 py-12 md:py-16">
        {/* Section header — minimal */}
        <div className="mb-8 md:mb-10">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#60A5FA" }}
          >
            Product Architecture
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight max-w-xl">
            검색부터 재고까지, 운영 체인 전체를 연결합니다
          </h2>
        </div>

        {/* 3 architecture frames — action strip first */}
        <div className="space-y-3">
          {FRAMES.map((frame, frameIdx) => (
            <div
              key={frame.stage}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
            >
              {/* Header: stage + title (1 line each) */}
              <div className="px-5 md:px-8 pt-5 pb-3 md:pt-6 md:pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ backgroundColor: "#142840", color: "#60A5FA" }}
                  >
                    {frame.stage}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: "#3A5068" }}>
                    {frameIdx + 1} / {FRAMES.length}
                  </span>
                </div>
                <h3 className="text-[14px] md:text-[16px] font-bold text-white leading-snug">
                  {frame.title}
                </h3>
              </div>

              {/* Action strip — the core visual */}
              <div
                className="px-5 md:px-8 py-3 flex items-center gap-0 overflow-x-auto"
                style={{ backgroundColor: "#071222", borderTop: "1px solid #0F1F35", borderBottom: "1px solid #0F1F35" }}
              >
                {frame.flow.map((step, i) => (
                  <div key={step} className="flex items-center flex-shrink-0">
                    <span
                      className="text-[10px] md:text-[11px] font-semibold px-3 py-1.5 rounded"
                      style={{
                        backgroundColor: i === 0 ? "#142840" : "transparent",
                        color: i === 0 ? "#60A5FA" : "#5A6A7E",
                        border: i === 0 ? "1px solid #1E3A5C" : "1px solid #162A42",
                      }}
                    >
                      {step}
                    </span>
                    {i < frame.flow.length - 1 && (
                      <ArrowRight className="h-3 w-3 mx-1.5 flex-shrink-0" style={{ color: "#2A4060" }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Tokens — 3 only, inline */}
              <div className="px-5 md:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {frame.tokens.map((token) => (
                    <span
                      key={token}
                      className="text-[10px] md:text-[11px] font-medium px-2.5 py-1 rounded"
                      style={{ backgroundColor: "#0D1E35", color: "#8A99AF", border: "1px solid #1A2D48" }}
                    >
                      {token}
                    </span>
                  ))}
                </div>
                {/* Handoff */}
                <div className="hidden md:flex items-center gap-1.5">
                  <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#3A5068" }} />
                  <span className="text-[10px] font-medium" style={{ color: "#60A5FA" }}>{frame.next}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
