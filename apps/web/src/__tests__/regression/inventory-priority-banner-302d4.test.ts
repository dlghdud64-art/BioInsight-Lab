/**
 * §11.302d-4 #inventory-priority-banner — inventory-content.tsx 우선 처리
 *   배너 (호영님 spec "긴급 재발주 필요" 안내 박스) 신호등 색상 의미
 *   역전 정정.
 *
 * 호영님 spec 정합 swap (의미 역전 정정):
 *   priorityExpiredLot (이미 만료) → 위험 red (bg-red-100, 큰 박스
 *     가독성 — KPI 카드 spec red-600 white 대신)
 *   expiringSoon (만료 임박)       → 검토 yellow (이전: red 잘못)
 *   lowOrOutOfStock (재주문 필요)  → 긴급 red (이전: yellow 잘못)
 *   fallback (issuesCount=0)       → slate (그대로)
 *
 * button color 정합:
 *   priorityExpiredLot or lowOrOut → red-600 white (위험/긴급 action)
 *   expiringSoon only              → yellow-600 white (검토 action)
 *
 * Out of Scope (§11.302d-5 별도 batch):
 *   line 2070-2094 "요약 칩" (만료 임박 / 부족 품절 / 전체 재고) —
 *     동일 색상 역전 + "전체 재고" 칩 §11.302c 정합 제거 여부
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/inventory/inventory-content.tsx"),
  "utf8",
);

describe("§11.302d-4 — 우선 처리 배너 신호등 의미 정합", () => {
  it("§11.302d-4 trace marker", () => {
    expect(SRC).toMatch(/§11\.302d-4/);
  });

  describe("배경 색상 — 의미 역전 정정", () => {
    it("priorityExpiredLot → border-red-200 bg-red-100 (위험)", () => {
      expect(SRC).toMatch(/priorityExpiredLot \? "border-red-200 bg-red-100"/);
    });

    it("expiringSoon → border-yellow-200 bg-yellow-100 (검토, 이전 red 정정)", () => {
      expect(SRC).toMatch(/expiringSoonCount > 0 \? "border-yellow-200 bg-yellow-100"/);
    });

    it("lowOrOutOfStock → border-red-200 bg-red-100 (긴급, 이전 yellow 정정)", () => {
      expect(SRC).toMatch(/lowOrOutOfStockCount > 0 \? "border-red-200 bg-red-100"/);
    });

    it("fallback → border-slate-200 bg-slate-50 보존", () => {
      expect(SRC).toMatch(/: "border-slate-200 bg-slate-50"/);
    });
  });

  describe("icon container 배경 + icon color — spec 정합", () => {
    it("priorityExpiredLot icon → bg-red-200 + Trash2 text-red-700", () => {
      expect(SRC).toMatch(/priorityExpiredLot \? "bg-red-200"/);
      expect(SRC).toMatch(/<Trash2 className="h-4 w-4 text-red-700" \/>/);
    });

    it("expiringSoon icon → bg-yellow-200 + Calendar text-yellow-700 (이전 red 정정)", () => {
      expect(SRC).toMatch(/expiringSoonCount > 0 \? "bg-yellow-200"/);
      expect(SRC).toMatch(/<Calendar className="h-4 w-4 text-yellow-700" \/>/);
    });

    it("lowOrOutOfStock icon → bg-red-200 + AlertTriangle text-red-700 (이전 yellow 정정)", () => {
      expect(SRC).toMatch(/lowOrOutOfStockCount > 0 \? "bg-red-200"/);
      expect(SRC).toMatch(/<AlertTriangle className="h-4 w-4 text-red-700" \/>/);
    });
  });

  describe("button color — 위험/긴급 vs 검토 분기", () => {
    it("expiringSoon only && !priorityExpired → yellow-600 white (검토 action)", () => {
      expect(SRC).toMatch(
        /expiringSoonCount > 0 && !priorityExpiredLot \? "bg-yellow-600 hover:bg-yellow-700 text-white"/,
      );
    });

    it("그 외 (priorityExpired or lowOrOut) → red-600 white (위험/긴급 action)", () => {
      expect(SRC).toMatch(/: "bg-red-600 hover:bg-red-700 text-white"/);
    });
  });

  describe("회귀 0 — 핵심 logic 보존", () => {
    it("파일럿 결정 카드가 보이면 중복 배너를 숨긴다", () => {
      expect(SRC).toMatch(/\{!showLotIssueDecisionStrip && \(issuesCount > 0 \? \(/);
      expect(SRC).toMatch(/\{!showLotIssueDecisionStrip && \(\(\) => \{/);
    });

    it("정상 상태 fallback (emerald + 모든 재고 정상) 보존", () => {
      expect(SRC).toMatch(/border-emerald-200 bg-emerald-50/);
      expect(SRC).toMatch(/모든 재고 정상 — 즉시 처리할 항목 없음/);
    });

    it("배너 텍스트 4 분기 보존 (priorityExpired / expiringSoon / lowOrOut / fallback)", () => {
      expect(SRC).toMatch(/우선 처리: 만료 lot/);
      expect(SRC).toMatch(/우선 처리: 만료 임박/);
      expect(SRC).toMatch(/우선 처리: 재고 부족/);
      expect(SRC).toMatch(/처리 대기/);
    });

    it("openDisposalDock + handlePriorityQueueAction onClick 보존", () => {
      expect(SRC).toMatch(/openDisposalDock\(priorityExpiredLot\)/);
      expect(SRC).toMatch(/handlePriorityQueueAction\(topPriorityQueueItem\)/);
    });
  });
});
