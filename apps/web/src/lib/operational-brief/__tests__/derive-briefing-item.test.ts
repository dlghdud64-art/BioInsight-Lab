/**
 * §brief-redesign — BriefingItem 파생 단위테스트 (P2)
 *
 * canonical UnifiedInboxItem → BriefingItem 파생 정확성 검증.
 * 신규 truth 0 / hot 분류 / data-days 숫자 / primaryAction 가드 / 스트립 집계.
 */
import { describe, it, expect } from "vitest";
import type { UnifiedInboxItem } from "@/lib/ops-console/inbox-adapter";
import {
  deriveBriefingItem,
  isHot,
  resolvePrimaryAction,
  soonestDueDays,
  summarizeBriefing,
} from "@/lib/operational-brief/derive-briefing-item";

function makeItem(over: Partial<UnifiedInboxItem> = {}): UnifiedInboxItem {
  return {
    id: "i1",
    workType: "quote_response_review" as UnifiedInboxItem["workType"],
    entityId: "e1",
    entityRoute: "/dashboard/quotes/e1",
    title: "견적 검토",
    summary: "공급사 회신 확인 필요",
    priority: "p2",
    dueState: { label: "3일 남음", isOverdue: false, tone: "due_soon", daysUntil: 3 },
    nextAction: "회신 확인",
    sourceModule: "quote",
    riskBadges: [],
    updatedAt: new Date(0).toISOString(),
    triageGroup: "due_soon" as UnifiedInboxItem["triageGroup"],
    ...over,
  };
}

describe("§brief-redesign — 모듈 매핑", () => {
  it("quote/po/receiving/stock_risk → m-quote/m-order/m-recv/m-inv + 한국어 라벨", () => {
    expect(deriveBriefingItem(makeItem({ sourceModule: "quote" }))).toMatchObject({ moduleClass: "m-quote", moduleLabel: "견적" });
    expect(deriveBriefingItem(makeItem({ sourceModule: "po" }))).toMatchObject({ moduleClass: "m-order", moduleLabel: "발주" });
    expect(deriveBriefingItem(makeItem({ sourceModule: "receiving" }))).toMatchObject({ moduleClass: "m-recv", moduleLabel: "입고" });
    expect(deriveBriefingItem(makeItem({ sourceModule: "stock_risk" }))).toMatchObject({ moduleClass: "m-inv", moduleLabel: "재고" });
  });
});

describe("§brief-redesign — hot(지금 처리) 분류", () => {
  it("p0/p1 → hot", () => {
    expect(isHot(makeItem({ priority: "p0" }))).toBe(true);
    expect(isHot(makeItem({ priority: "p1" }))).toBe(true);
  });
  it("p2 + 마감 정상 + 차단 없음 → 검토 대기(hot=false)", () => {
    expect(isHot(makeItem({ priority: "p2", dueState: { label: "5일 남음", isOverdue: false, tone: "normal", daysUntil: 5 } }))).toBe(false);
  });
  it("마감 초과 → hot", () => {
    expect(isHot(makeItem({ priority: "p2", dueState: { label: "2일 초과", isOverdue: true, tone: "overdue", daysUntil: -2 } }))).toBe(true);
  });
  it("차단(blockedReason) → hot", () => {
    expect(isHot(makeItem({ priority: "p3", blockedReason: "공급사 미회신" }))).toBe(true);
  });
});

describe("§brief-redesign — due(data-days + soon)", () => {
  it("days = dueState.daysUntil 투영, soon = due_soon|overdue", () => {
    const b = deriveBriefingItem(makeItem({ dueState: { label: "오늘 마감", isOverdue: false, tone: "due_soon", daysUntil: 0 } }));
    expect(b.due.days).toBe(0);
    expect(b.due.soon).toBe(true);
  });
  it("normal tone → soon=false, daysUntil 미설정 → days=null", () => {
    const b = deriveBriefingItem(makeItem({ dueState: { label: "기한 없음", isOverdue: false, tone: "normal" } }));
    expect(b.due.soon).toBe(false);
    expect(b.due.days).toBeNull();
  });
});

describe("§brief-redesign — primaryAction 가드(dead button 0)", () => {
  it("실액션 미연동 → null (단일 act-go CTA)", () => {
    expect(resolvePrimaryAction(makeItem())).toBeNull();
    expect(deriveBriefingItem(makeItem()).primaryAction).toBeNull();
  });
});

describe("§brief-redesign — 요약 스트립 집계", () => {
  it("soonestDueDays = 최솟값(null 제외), 전부 null이면 null", () => {
    const items = [
      deriveBriefingItem(makeItem({ dueState: { label: "3일", isOverdue: false, tone: "due_soon", daysUntil: 3 } })),
      deriveBriefingItem(makeItem({ dueState: { label: "1일", isOverdue: false, tone: "due_soon", daysUntil: 1 } })),
      deriveBriefingItem(makeItem({ dueState: { label: "기한 없음", isOverdue: false, tone: "normal" } })),
    ];
    expect(soonestDueDays(items)).toBe(1);
    const allNull = [deriveBriefingItem(makeItem({ dueState: { label: "기한 없음", isOverdue: false, tone: "normal" } }))];
    expect(soonestDueDays(allNull)).toBeNull();
  });
  it("summarizeBriefing urgent/review/soonestDays", () => {
    const items = [
      deriveBriefingItem(makeItem({ priority: "p0", dueState: { label: "2일 초과", isOverdue: true, tone: "overdue", daysUntil: -2 } })),
      deriveBriefingItem(makeItem({ priority: "p2", dueState: { label: "5일", isOverdue: false, tone: "normal", daysUntil: 5 } })),
    ];
    expect(summarizeBriefing(items)).toEqual({ urgent: 1, review: 1, soonestDays: -2 });
  });
});
