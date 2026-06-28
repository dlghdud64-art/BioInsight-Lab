/**
 * §brief-redesign — BriefingItem 파생 (운영 브리핑 핸드오프 2026-06-28)
 *
 * canonical UnifiedInboxItem → 운영 브리핑 카드 1건(BriefingItem) 파생.
 * **신규 truth 생성 0** — 모든 값은 UnifiedInboxItem 에서 파생/투영.
 *
 * 설계 결정(호영님 승인):
 *  - hot(지금 처리) = priority p0/p1 ∨ 마감 초과 ∨ 차단. 그 외 = 검토 대기.
 *  - due.days = dueState.daysUntil(숫자) → 요약 스트립 "임박 마감" 최솟값 계산.
 *  - primaryAction = 실제 wired 인라인 액션이 있을 때만 non-null.
 *      없으면 null → UI 는 단일 "화면 이동(act-go)" CTA 만 노출(dead button/fake success 0).
 *  - aiReason 기본값 = summary(canonical). 컴포넌트가 useOperationalBriefNarrative 로 override.
 */

import type { UnifiedInboxItem, InboxSourceModule } from "@/lib/ops-console/inbox-adapter";

export type BriefingModuleClass = "m-quote" | "m-order" | "m-recv" | "m-inv";

/** 핸드오프 색토큰 매핑: 견적=blue / 발주=purple / 입고=emerald / 재고=amber. */
const MODULE_CLASS: Record<InboxSourceModule, BriefingModuleClass> = {
  quote: "m-quote",
  po: "m-order",
  receiving: "m-recv",
  stock_risk: "m-inv",
};

const MODULE_LABEL: Record<InboxSourceModule, string> = {
  quote: "견적",
  po: "발주",
  receiving: "입고",
  stock_risk: "재고",
};

export interface BriefingPrimaryAction {
  /** 버튼 라벨 (예: "재주문 검토"). */
  label: string;
  /** 모듈 액션 식별자 — 실제 wired API 에 연결. */
  action: string;
}

export interface BriefingItem {
  id: string;
  module: InboxSourceModule;
  moduleClass: BriefingModuleClass;
  moduleLabel: string;
  /** true = "지금 처리" 섹션(rose), false = "검토 대기". */
  hot: boolean;
  due: {
    text: string;
    /** rose 강조(마감 임박/초과). */
    soon: boolean;
    /** 마감까지 남은 일수(임박마감 계산용). null = 일수 개념 없음. */
    days: number | null;
  };
  title: string;
  subtitle: string;
  /** AI 근거 1줄 — 기본 summary, 컴포넌트가 narrative 로 override. */
  aiReason: string;
  /** null = 실액션 없음 → 단일 act-go CTA. */
  primaryAction: BriefingPrimaryAction | null;
  /** 모듈 화면 deep-link(act-go). */
  goHref: string;
}

/** hot = 지금 처리(마감·차단 임박). */
export function isHot(item: UnifiedInboxItem): boolean {
  return (
    item.priority === "p0" ||
    item.priority === "p1" ||
    item.dueState.isOverdue ||
    Boolean(item.blockedReason)
  );
}

/**
 * 실액션 가드 — 실제 wired 인라인 mutation/action 이 있을 때만 non-null.
 *
 * 현재 canonical(UnifiedInboxItem)에는 구조화된 인라인 액션 계약이 없다
 * (nextAction = 텍스트, vendorEmail = PO 한정 quick-action 힌트뿐).
 * 따라서 기본 null → UI 는 단일 화면이동 CTA. **fake success/dead button 차단.**
 * 실제 액션 wiring 도입 시 여기서 workType/module 별 매핑을 추가한다.
 */
export function resolvePrimaryAction(_item: UnifiedInboxItem): BriefingPrimaryAction | null {
  return null;
}

export function deriveBriefingItem(item: UnifiedInboxItem): BriefingItem {
  return {
    id: item.id,
    module: item.sourceModule,
    moduleClass: MODULE_CLASS[item.sourceModule],
    moduleLabel: MODULE_LABEL[item.sourceModule],
    hot: isHot(item),
    due: {
      text: item.dueState.label,
      soon: item.dueState.tone === "due_soon" || item.dueState.isOverdue,
      days: item.dueState.daysUntil ?? null,
    },
    title: item.title,
    subtitle: item.summary,
    aiReason: item.summary,
    primaryAction: resolvePrimaryAction(item),
    goHref: item.entityRoute,
  };
}

/** 요약 스트립 "임박 마감" = 보이는 항목의 due.days 최솟값(null 제외). 없으면 null. */
export function soonestDueDays(items: BriefingItem[]): number | null {
  const ds = items
    .map((i) => i.due.days)
    .filter((d): d is number => d !== null);
  return ds.length ? Math.min(...ds) : null;
}

/** 요약 스트립 집계 — 보이는 항목 기준 긴급/검토대기/임박마감(recalcStrip 데이터). */
export function summarizeBriefing(items: BriefingItem[]): {
  urgent: number;
  review: number;
  soonestDays: number | null;
} {
  const urgent = items.filter((i) => i.hot).length;
  return {
    urgent,
    review: items.length - urgent,
    soonestDays: soonestDueDays(items),
  };
}
