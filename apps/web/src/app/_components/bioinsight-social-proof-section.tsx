"use client";

import { Search, GitCompareArrows, FileText, Package, ArrowRight } from "lucide-react";

/*
 * ── Capability Architecture Band ───────────────────────────────────
 *  Role: Hero 선언 직후, LabAxis가 책임지는 핵심 운영 surface 4개
 *  Layout: 2×2 rich card grid
 *  Card structure: 단계 라벨 → 제목 → 한 줄 정의 → 처리 객체 → 핵심 판단 → handoff
 *  NOT: feature grid / marketing card / abstract adjective
 *  IS:  "어떤 운영 순간을 책임지는가" — object/action language
 * ────────────────────────────────────────────────────────────────────
 */

const CAPABILITIES = [
  {
    icon: Search,
    stage: "SEARCH",
    title: "검색 워크벤치",
    definition: "후보를 찾는 단계가 아니라, 비교 가능한 후보군을 구조화하는 시작점입니다.",
    objects: "시약명 · 제조사 · 카탈로그 번호 · CAS No.",
    judgments: ["후보 정리", "필터 적용", "비교 대상 선별", "seed 구성"],
    handoff: "비교 판단면으로 바로 연결",
    summary: "흩어진 검색 결과를 끝없이 훑는 대신, 다음 판단에 필요한 후보만 구조화합니다.",
  },
  {
    icon: GitCompareArrows,
    stage: "COMPARE",
    title: "비교 판단면",
    definition: "같은 후보를 나열하는 화면이 아니라, 차이점 중심으로 결정을 내리는 surface입니다.",
    objects: "Exact Match · Equivalent · Substitute · Hold",
    judgments: ["delta-first 비교", "shortlist", "exclude", "request-direct 분기"],
    handoff: "요청·견적 작업면으로 즉시 전환",
    summary: "스펙을 다시 읽는 비교가 아니라, 무엇을 바로 요청할지 판단하는 비교입니다.",
  },
  {
    icon: FileText,
    stage: "REQUEST",
    title: "요청·견적 작업면",
    definition: "비교 결과를 다시 정리하지 않고, 선택한 후보를 요청 객체로 바로 전환합니다.",
    objects: "선택 품목 · 공급사 · 수량 · 요청 사유 · 견적 대상",
    judgments: ["요청 생성", "공급사 정리", "누락 검토", "handoff 최소화"],
    handoff: "견적 관리 · 승인 흐름으로 연결",
    summary: "비교와 요청이 분리되지 않아, 검토가 끝난 결과를 바로 운영 객체로 넘길 수 있습니다.",
  },
  {
    icon: Package,
    stage: "RECEIVE & STOCK",
    title: "입고·재고 운영면",
    definition: "구매 이후를 별도 도구로 넘기지 않고, lot와 유효기간까지 같은 흐름 안에서 관리합니다.",
    objects: "입고 확인 · Lot · 유효기간 · 부족 · 재주문",
    judgments: ["입고 검토", "부분 입고 처리", "재고 반영", "재주문 판단"],
    handoff: "재고 운영 · 재구매 재진입으로 연결",
    summary: "요청에서 끝나는 시스템이 아니라, 입고와 가용 재고까지 이어지는 운영 OS입니다.",
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
      <div className="max-w-[1240px] mx-auto px-4 py-10 md:py-14">
        {/* Section header */}
        <div className="mb-6 md:mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: "#60A5FA" }}
          >
            Core Operating Capabilities
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-2">
            검색부터 입고·재고까지, 핵심 작업면이 이어지는 구조
          </h2>
          <p className="text-[11px] md:text-xs max-w-2xl" style={{ color: "#6A7A8E" }}>
            LabAxis는 기능을 나열하는 도구가 아니라, 연구 구매 흐름의 주요 판단면과 작업면을 하나의 운영 체인으로 연결합니다.
          </p>
        </div>

        {/* 2×2 capability cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="rounded-lg overflow-hidden"
                style={{ backgroundColor: "#081628", border: "1px solid #162A42" }}
              >
                {/* Card header: stage marker + icon + title */}
                <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #0F1F35" }}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: "#142840", color: "#60A5FA" }}
                    >
                      {cap.stage}
                    </span>
                    <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: "#142840" }}>
                      <Icon className="h-3 w-3" style={{ color: "#4A5E78" }} strokeWidth={1.8} />
                    </div>
                  </div>
                  <h3 className="text-[13px] font-bold text-white mb-1">{cap.title}</h3>
                  <p className="text-[11px] leading-snug" style={{ color: "#8A99AF" }}>{cap.definition}</p>
                </div>

                {/* Card body: objects + judgments */}
                <div className="px-4 py-3 space-y-2.5">
                  {/* Processing objects */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "#4A5E78" }}>처리 객체</p>
                    <p className="text-[10px]" style={{ color: "#6A7A8E" }}>{cap.objects}</p>
                  </div>

                  {/* Key judgments/actions */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "#4A5E78" }}>핵심 판단</p>
                    <div className="flex flex-wrap gap-1">
                      {cap.judgments.map((j) => (
                        <span
                          key={j}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "#0D1E35", color: "#8A99AF", border: "1px solid #1A2D48" }}
                        >
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Summary — one sentence proof */}
                  <p className="text-[10px] leading-relaxed" style={{ color: "#5A6A7E" }}>
                    {cap.summary}
                  </p>
                </div>

                {/* Card footer: handoff strip */}
                <div
                  className="px-4 py-2.5 flex items-center gap-1.5"
                  style={{ backgroundColor: "#071422", borderTop: "1px solid #0F1F35" }}
                >
                  <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#3A5068" }} />
                  <span className="text-[10px] font-medium" style={{ color: "#60A5FA" }}>{cap.handoff}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
