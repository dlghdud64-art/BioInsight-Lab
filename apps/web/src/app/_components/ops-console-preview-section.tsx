"use client";

import { ListChecks, BarChart3, Package, ArrowRight } from "lucide-react";

/*
 * ── Workbench Preview ──────────────────────────────────────────────
 *  Role: 실제 운영면에서 검토와 작업이 이어지는 구조를 보여줌
 *  Tone: "기능이 많다"가 아니라 "작업면이 강하다"
 *  Card structure: 작업 유형 → 판단 포인트 → 주요 객체 → 다음 액션
 *  NOT: feature card / marketing description / table mockup
 * ────────────────────────────────────────────────────────────────────
 */

const WORKBENCH_CARDS = [
  {
    icon: ListChecks,
    type: "작업 큐 정리",
    judgment: "지금 요청할 후보와 보류 후보 분리",
    objects: ["candidate set", "compare decision", "hold list"],
    nextAction: "요청 객체 생성",
    detail: "검색에서 올라온 후보를 비교 결과에 따라 즉시 요청 / 보류 / 제외로 분기합니다. 판단이 끝난 항목만 다음 단계로 넘어갑니다.",
  },
  {
    icon: BarChart3,
    type: "일일 검토와 판단",
    judgment: "차이점, 예외, blocker 우선 확인",
    objects: ["quote response", "exception flag", "approval state"],
    nextAction: "승인 또는 재검토 전환",
    detail: "견적 회신, 납기 이슈, 승인 대기 건을 한 화면에서 확인합니다. 예외와 blocker가 먼저 올라오도록 정렬됩니다.",
  },
  {
    icon: Package,
    type: "입고 후 운영 연결",
    judgment: "lot, 유효기간, 부족 재고 확인",
    objects: ["receiving record", "stock snapshot", "reorder signal"],
    nextAction: "재고 반영 또는 재주문 판단",
    detail: "입고 확인과 동시에 lot·유효기간이 등록되고, 부족 재고가 감지되면 재주문 판단 화면으로 바로 이어집니다.",
  },
];

export function OpsConsolePreviewSection() {
  return (
    <section className="py-12 md:py-16" style={{ backgroundColor: "#0E1D32", borderTop: "1px solid #162A42" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">
        {/* Section header */}
        <div className="mb-6 md:mb-8">
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
            style={{ color: "#60A5FA" }}
          >
            Workbench Preview
          </p>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight mb-1.5">
            실제 운영면에서 검토와 작업이 이어지는 구조
          </h2>
          <p className="text-[11px] md:text-xs max-w-2xl" style={{ color: "#6A7A8E" }}>
            LabAxis의 각 작업면은 보기 좋은 카드가 아니라, 지금 처리할 일과 다음 단계 handoff가 함께 보이도록 설계되어 있습니다.
          </p>
        </div>

        {/* 3 workbench cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKBENCH_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.type}
                className="rounded-lg overflow-hidden flex flex-col"
                style={{ backgroundColor: "#0A1828", border: "1px solid #162A42" }}
              >
                {/* Card header: work type */}
                <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #0F1F35" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "#142840" }}>
                      <Icon className="h-3 w-3" style={{ color: "#60A5FA" }} strokeWidth={1.8} />
                    </div>
                    <span className="text-[12px] font-bold text-white">{card.type}</span>
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex-1 space-y-3">
                  {/* Judgment point — the decision this surface accelerates */}
                  <div className="rounded px-2.5 py-2" style={{ backgroundColor: "#0D1428", border: "1px solid #1A2D48" }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#4A5E78" }}>판단 포인트</p>
                    <p className="text-[11px] font-medium" style={{ color: "#C8D4E5" }}>{card.judgment}</p>
                  </div>

                  {/* Objects */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "#4A5E78" }}>주요 객체</p>
                    <div className="flex flex-wrap gap-1">
                      {card.objects.map((obj) => (
                        <span
                          key={obj}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: "#0D1E35", color: "#6A7A8E", border: "1px solid #1A2D48" }}
                        >
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Detail */}
                  <p className="text-[10px] leading-relaxed" style={{ color: "#5A6A7E" }}>
                    {card.detail}
                  </p>
                </div>

                {/* Card footer: next action */}
                <div
                  className="px-4 py-2.5 flex items-center gap-1.5 mt-auto"
                  style={{ backgroundColor: "#071422", borderTop: "1px solid #0F1F35" }}
                >
                  <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#3A5068" }} />
                  <span className="text-[9px] font-bold uppercase mr-1" style={{ color: "#4A5E78" }}>Next</span>
                  <span className="text-[10px] font-medium" style={{ color: "#60A5FA" }}>{card.nextAction}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
