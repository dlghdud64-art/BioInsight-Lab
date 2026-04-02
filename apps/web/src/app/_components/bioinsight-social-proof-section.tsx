"use client";

import { ArrowRight } from "lucide-react";

/*
 * ── Product Architecture Frame ─────────────────────────────────────
 *  Role: Hero 선언 직후, LabAxis 제품 구조를 한 번에 이해시키는 구간
 *  Layout: 3개 대형 프레임 (stacked, full-width feel)
 *  Card ≠ feature card. Frame = 운영 계층 소개
 *  "텍스트를 읽기 전에도 제품 구조가 먼저 보여야 함"
 *
 *  Frame 1: Sourcing & Compare
 *  Frame 2: Request & Approval
 *  Frame 3: Receive & Stock
 * ────────────────────────────────────────────────────────────────────
 */

const FRAMES = [
  {
    stage: "SOURCING & COMPARE",
    title: "후보를 찾는 것이 아니라, 비교 가능한 상태로 정리합니다",
    definition: "흩어진 검색 결과를 구조화하고, 차이점 중심으로 판단해 shortlist를 만드는 구간입니다.",
    flow: ["Search Seed", "Candidate Triage", "Compare Decision"],
    points: [
      { label: "후보 구조화", desc: "시약명·카탈로그·CAS 기준으로 비교 가능한 seed 구성" },
      { label: "delta 판단", desc: "스펙·가격·납기 차이가 먼저 보이는 비교면" },
      { label: "shortlist", desc: "요청 대상과 보류 후보를 즉시 분기" },
      { label: "hold / exclude", desc: "불필요 후보를 판단면에서 바로 제외" },
    ],
    next: "요청·승인 흐름으로 바로 연결",
    accent: "#2563EB",
  },
  {
    stage: "REQUEST & APPROVAL",
    title: "비교 결과를 다시 옮기지 않고, 요청과 승인 흐름으로 넘깁니다",
    definition: "선택한 후보를 요청 객체로 전환하고, 견적 수집부터 승인·발주까지 하나의 흐름으로 이어지는 구간입니다.",
    flow: ["Request Object", "Quote Review", "Approval", "PO"],
    points: [
      { label: "요청 생성", desc: "비교표에서 바로 요청 객체 생성 — 수기 handoff 없음" },
      { label: "견적 관리", desc: "공급사별 회신을 한 화면에서 비교·확정" },
      { label: "승인 연결", desc: "요청-승인 라인이 끊기지 않고 이어짐" },
      { label: "발주 전환", desc: "승인 완료 → PO 자동 연결, 누락·지연 없음" },
    ],
    next: "입고·재고 운영면으로 연결",
    accent: "#2563EB",
  },
  {
    stage: "RECEIVE & STOCK",
    title: "입고 이후 이력과 재고 운영까지 하나의 흐름으로 연결합니다",
    definition: "구매 이후를 별도 도구로 넘기지 않고, lot·유효기간·재주문까지 같은 운영 체인 안에서 관리하는 구간입니다.",
    flow: ["Receiving", "Lot / Expiry", "Stock Truth", "Reorder"],
    points: [
      { label: "입고 반영", desc: "입고 확인 즉시 수량·lot이 재고에 반영" },
      { label: "lot 관리", desc: "유효기간·보관 조건이 입고 시점에 등록" },
      { label: "부족 판단", desc: "가용 재고 기준으로 부족 신호 자동 감지" },
      { label: "재주문", desc: "부족 → 재구매 요청으로 운영 체인 재진입" },
    ],
    next: "소싱 → 재구매 사이클 재진입",
    accent: "#2563EB",
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
        {/* Section header */}
        <div className="mb-8 md:mb-10">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#60A5FA" }}
          >
            Product Architecture
          </p>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-2.5 max-w-2xl">
            검색부터 재고까지, 연구 구매 운영 체인 전체를 하나로 연결합니다
          </h2>
          <p className="text-[12px] md:text-[13px] max-w-2xl" style={{ color: "#6A7A8E" }}>
            LabAxis는 기능을 나열하는 도구가 아니라, 구매 흐름의 주요 판단면과 작업면을 끊기지 않는 하나의 운영 체인으로 연결합니다.
          </p>
        </div>

        {/* 3 large product architecture frames */}
        <div className="space-y-4">
          {FRAMES.map((frame, frameIdx) => (
            <div
              key={frame.stage}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
            >
              {/* Frame header — stage label + title + definition */}
              <div className="px-5 md:px-8 pt-6 pb-4 md:pt-8 md:pb-5">
                <div className="flex items-center gap-3 mb-3">
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
                <h3 className="text-[15px] md:text-[17px] font-bold text-white leading-snug mb-2">
                  {frame.title}
                </h3>
                <p className="text-[11px] md:text-[12px] leading-relaxed max-w-2xl" style={{ color: "#8A99AF" }}>
                  {frame.definition}
                </p>
              </div>

              {/* Structure flow strip — mini structural diagram */}
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
                        border: i === 0 ? "1px solid #1A3A5C" : "1px solid #162A42",
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

              {/* Points grid — 4 key objects/actions */}
              <div className="px-5 md:px-8 py-5 md:py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {frame.points.map((pt) => (
                    <div key={pt.label}>
                      <p className="text-[11px] font-bold text-white mb-0.5">{pt.label}</p>
                      <p className="text-[10px] leading-relaxed" style={{ color: "#5A6A7E" }}>{pt.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frame footer — next flow handoff */}
              <div
                className="px-5 md:px-8 py-2.5 flex items-center gap-1.5"
                style={{ backgroundColor: "#071222", borderTop: "1px solid #0F1F35" }}
              >
                <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#3A5068" }} />
                <span className="text-[10px] font-medium" style={{ color: "#60A5FA" }}>{frame.next}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
