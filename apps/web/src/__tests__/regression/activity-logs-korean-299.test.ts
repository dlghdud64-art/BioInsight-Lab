/**
 * §11.299 #activity-logs-korean — 활동 로그 개발 용어 → 사용자 용어 한글화.
 *
 * 호영님 P1 (2026-05-24): /dashboard/activity-logs 의 raw 영문 enum
 *   (ORDER_FOLLOWUP_GENERATED 등) + "엔티티 유형" / "전체 엔티티" 개발
 *   용어가 사용자 화면 노출 회귀 차단.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../app/dashboard/activity-logs/page.tsx"),
  "utf8",
);

describe("§11.299 — 활동 로그 한글화", () => {
  it("§11.299 trace marker", () => {
    expect(SRC).toMatch(/§11\.299/);
  });

  describe("ACTIVITY_TYPE_LABELS 확장 — 30+ enum 한글 매핑", () => {
    it("ORDER_FOLLOWUP_GENERATED 한글 매핑 추가 (호영님 spec 호출)", () => {
      expect(SRC).toMatch(/ORDER_FOLLOWUP_GENERATED:\s*"발주 후속 조치 생성"/);
    });

    it("EMAIL_SENT / EMAIL_DRAFT_GENERATED / VENDOR_REPLY_LOGGED 한글", () => {
      expect(SRC).toMatch(/EMAIL_SENT:\s*"이메일 발송"/);
      expect(SRC).toMatch(/EMAIL_DRAFT_GENERATED:\s*"이메일 초안 생성"/);
      expect(SRC).toMatch(/VENDOR_REPLY_LOGGED:\s*"공급사 회신 기록"/);
    });

    it("AI_TASK_* / INVENTORY_RESTOCK_* / PURCHASE_REQUEST_* 카테고리", () => {
      expect(SRC).toMatch(/AI_TASK_CREATED:\s*"AI 작업 생성"/);
      expect(SRC).toMatch(/INVENTORY_RESTOCK_SUGGESTED:\s*"재발주 제안"/);
      expect(SRC).toMatch(/PURCHASE_REQUEST_CREATED:\s*"구매 요청 생성"/);
    });

    it("ORDER_STATUS_* 분기 3종 한글", () => {
      expect(SRC).toMatch(/ORDER_STATUS_CHANGE_PROPOSED:\s*"발주 상태 변경 제안"/);
      expect(SRC).toMatch(/ORDER_STATUS_CHANGE_APPROVED:\s*"발주 상태 변경 승인"/);
      expect(SRC).toMatch(/ORDER_STATUS_CHANGED:\s*"발주 상태 변경"/);
    });
  });

  describe("ENTITY_TYPE_LABELS 새 mapping", () => {
    it("ENTITY_TYPE_LABELS 정의 + quote/product/order/inventory/vendor 한글", () => {
      expect(SRC).toMatch(/const ENTITY_TYPE_LABELS:\s*Record<string, string>/);
      expect(SRC).toMatch(/quote:\s*"견적"/);
      expect(SRC).toMatch(/product:\s*"제품"/);
      expect(SRC).toMatch(/order:\s*"발주"/);
      expect(SRC).toMatch(/inventory:\s*"재고"/);
      expect(SRC).toMatch(/vendor:\s*"공급사"/);
    });

    it("대소문자 혼재 cover (quote/QUOTE 모두 매핑)", () => {
      expect(SRC).toMatch(/QUOTE:\s*"견적"/);
      expect(SRC).toMatch(/ORDER:\s*"발주"/);
    });
  });

  describe("Filter 라벨 swap", () => {
    it('"엔티티 유형" → "대상 구분"', () => {
      expect(SRC).not.toMatch(/>엔티티 유형</);
      expect(SRC).toMatch(/대상 구분/);
    });

    it('"전체 엔티티" → "전체"', () => {
      expect(SRC).not.toMatch(/>전체 엔티티</);
      expect(SRC).toMatch(/<SelectItem value="all">전체</);
    });

    it('SelectItem 옵션 한글화 (리스트 → 견적 + 발주/재고/공급사 추가)', () => {
      expect(SRC).not.toMatch(/<SelectItem value="quote">리스트</);
      expect(SRC).toMatch(/<SelectItem value="quote">견적</);
      expect(SRC).toMatch(/<SelectItem value="order">발주</);
      expect(SRC).toMatch(/<SelectItem value="inventory">재고</);
      expect(SRC).toMatch(/<SelectItem value="vendor">공급사</);
    });
  });

  describe("raw 영문 enum 카드 표시 제거", () => {
    it("log.activityType raw mono code 표시 제거 (Badge 한글 라벨로 충분)", () => {
      expect(SRC).not.toMatch(/<span className="text-\[10px\] font-mono text-slate-400 break-all">\s*\{log\.activityType\}/);
    });

    it("log.entityType raw 표시 → ENTITY_TYPE_LABELS 한글 변환", () => {
      expect(SRC).toMatch(/ENTITY_TYPE_LABELS\[log\.entityType\] \|\| log\.entityType/);
    });
  });

  describe("회귀 0 — 핵심 기능 보존", () => {
    it("activityTypeFilter / entityTypeFilter useState 보존", () => {
      expect(SRC).toMatch(/activityTypeFilter, setActivityTypeFilter/);
      expect(SRC).toMatch(/entityTypeFilter, setEntityTypeFilter/);
    });

    it("ACTIVITY_TYPE_COLORS / ACTIVITY_TYPE_ICONS 보존", () => {
      expect(SRC).toMatch(/ACTIVITY_TYPE_COLORS/);
      expect(SRC).toMatch(/ACTIVITY_TYPE_ICONS/);
    });
  });
});
