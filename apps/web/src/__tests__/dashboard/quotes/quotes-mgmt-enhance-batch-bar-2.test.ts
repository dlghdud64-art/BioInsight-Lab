/**
 * §quotes-mgmt-enhance §2 — 하단 선택 바(batch-action-bar) 정합 리팩토링 sentinel
 *
 * 호영님 견적 관리 고도화 핸드오프 §2 (2026-07-12):
 *   실마찰 = 서브카운트 불일치 — 기존 "회신 대기"가 reminderEligibleCount
 *   (회신 0건 = 발송 전 포함)를 표기해 발송 전 건이 발송 가능/회신 대기
 *   양쪽에 이중 집계 (합 > 선택수).
 *
 * 델타 3종 (기존 컴포넌트 리팩토링 — greenfield 0):
 *   #1 서브카운트 = 선택의 "실제 분할" 파티션.
 *      발송 가능(dispatchable) + 보류(hardBlock) [= 발송 전 버킷]
 *      + 회신 대기(awaitingReplyCount: SENT·회신 0건)
 *      + 회신 도착(respondedSelectedCount: 비교/검토/완료)
 *      합 === selectedCount 불변식. canonical = deriveRailState (§11.351 동일 축).
 *   #2 액션별 대상수 배지 — 상태 변경[selectedCount] · 리마인더[reminderEligibleCount]
 *      · 검토 시작[dispatchableCount].
 *   #3 비활성 사유 인라인 — 툴팁 안에만 숨어 있던 disabled 사유를 바 안 상시
 *      노출(1줄). §11.230c (b)-2 Tooltip wrapper 는 a11y 용도로 병행 유지.
 *
 * canonical truth lock:
 *   - reminderEligibleCount 파생(page: responses.length === 0) 무접촉 —
 *     리마인더 CTA 배지/disabled 로만 사용 (§5 리마인더 고도화는 Phase 5).
 *   - dispatchableCount/hardBlockCount 파생(§11.351 request_not_sent 게이트 +
 *     getQuoteDispatchPreflight) 무접촉.
 *   - selectedQuoteIds / toggleQuoteSelection / 3 mutation CTA 배선 무접촉.
 *   - 보라 하단바(border-violet-200 bg-violet-50) 유지 · amber/orange 0 (신호등).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const BAR_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/batch-action-bar.tsx",
);
const page = readFileSync(PAGE_PATH, "utf8");
const bar = readFileSync(BAR_PATH, "utf8");

describe("§quotes-mgmt-enhance §2 #1 — 서브카운트 파티션 (합 === 선택수)", () => {
  it("page.tsx — awaitingReplyCount / respondedSelectedCount 파티션 useMemo (deriveRailState 축)", () => {
    expect(page).toMatch(
      /awaitingReplyCount, respondedSelectedCount \} = useMemo/,
    );
    // 파티션이 deriveRailState canonical 위에서 파생 (UI state 대체 금지)
    expect(page).toMatch(
      /awaitingReplyCount, respondedSelectedCount \} = useMemo[\s\S]{0,400}deriveRailState\(q\)/,
    );
    // 발송 전 버킷 = dispatchable + hardBlock (이중 집계 차단 continue)
    expect(page).toMatch(
      /rs === "request_not_sent"\) continue/,
    );
    // 회신 대기 = awaiting_responses | response_delayed (발송 후 회신 0건)
    expect(page).toMatch(
      /rs === "awaiting_responses" \|\| rs === "response_delayed"/,
    );
  });

  it("page.tsx — BatchActionBar 로 파티션 2 prop forward", () => {
    expect(page).toMatch(
      /BatchActionBar[\s\S]{0,900}awaitingReplyCount=\{awaitingReplyCount\}/,
    );
    expect(page).toMatch(
      /BatchActionBar[\s\S]{0,900}respondedSelectedCount=\{respondedSelectedCount\}/,
    );
  });

  it("bar — 파티션 prop 시그니처 (awaitingReplyCount / respondedSelectedCount)", () => {
    expect(bar).toMatch(/awaitingReplyCount\s*:\s*number/);
    expect(bar).toMatch(/respondedSelectedCount\s*:\s*number/);
  });

  it("bar — 서브라벨 '회신 대기' 가 awaitingReplyCount 표기 (reminderEligibleCount 이중 집계 잔재 0)", () => {
    expect(bar).toMatch(/회신 대기 \{awaitingReplyCount\}건/);
    expect(bar).not.toMatch(/회신 대기 \{reminderEligibleCount\}건/);
  });

  it("bar — '회신 도착' 버킷 신설 (respondedSelectedCount > 0 조건부)", () => {
    expect(bar).toMatch(
      /respondedSelectedCount > 0[\s\S]{0,400}회신 도착 \{respondedSelectedCount\}건/,
    );
  });

  it("bar — 발송 전 버킷 라벨 보존 (발송 가능 + 보류, §11.217 lineage)", () => {
    expect(bar).toMatch(/발송 가능 \{dispatchableCount\}건/);
    expect(bar).toMatch(/보류 \{hardBlockCount\}건/);
  });
});

describe("§quotes-mgmt-enhance §2 #2 — 액션별 대상수 배지", () => {
  it("상태 변경 CTA — selectedCount 배지", () => {
    expect(bar).toMatch(/상태 변경[\s\S]{0,400}\{selectedCount\}[\s\S]{0,40}<\/span>/);
  });

  it("리마인더 CTA — reminderEligibleCount 배지", () => {
    expect(bar).toMatch(/리마인더[\s\S]{0,400}\{reminderEligibleCount\}[\s\S]{0,40}<\/span>/);
  });

  it("검토 시작 CTA — dispatchableCount 배지", () => {
    expect(bar).toMatch(/검토 시작[\s\S]{0,300}\{dispatchableCount\}<\/span>/);
  });
});

describe("§quotes-mgmt-enhance §2 #3 — 비활성 사유 인라인", () => {
  it("인라인 사유 노출 (data-testid + disabled 분기 조건부)", () => {
    expect(bar).toMatch(
      /\(reviewDisabled \|\| reminderDisabled\) &&[\s\S]{0,300}data-testid="batch-disabled-reason-inline"/,
    );
    // 사유 텍스트 = 기존 tooltip 파생 재사용 (문구 이중 관리 0)
    expect(bar).toMatch(
      /batch-disabled-reason-inline[\s\S]{0,500}\{reviewDisabled \? reviewTooltip : reminderTooltip\}/,
    );
  });

  it("인라인 사유 = yellow 주의 (신호등 — amber 아님)", () => {
    expect(bar).toMatch(/batch-disabled-reason-inline[\s\S]{0,200}text-yellow-800/);
  });

  it("§11.230c (b)-2 Tooltip wrapper 병행 유지 (인라인이 Tooltip 대체 금지)", () => {
    expect(bar).toMatch(/reminderTooltip[\s\S]{0,600}TooltipContent/);
    expect(bar).toMatch(/reviewTooltip[\s\S]{0,600}TooltipContent/);
  });
});

describe("§quotes-mgmt-enhance §2 — invariant 보존", () => {
  it("보라 하단바 유지 (border-violet-200 + bg-violet-50)", () => {
    expect(bar).toMatch(/border-violet-200 bg-violet-50/);
  });

  it("amber/orange Tailwind class 0 (§11.302d-6b-2 신호등 lock)", () => {
    expect(bar).not.toMatch(/(bg|text|border|from|to|ring)-amber-/);
    expect(bar).not.toMatch(/(bg|text|border|from|to|ring)-orange-/);
  });

  it("reminderEligibleCount 파생 무접촉 (page — responses.length === 0)", () => {
    expect(page).toMatch(
      /const reminderEligibleCount = useMemo[\s\S]{0,300}length \?\? 0\) === 0/,
    );
  });

  it("§11.351 발송 집계 게이트 무접촉 (request_not_sent 만 dispatch 집계)", () => {
    expect(page).toMatch(
      /deriveRailState\(q\) !== "request_not_sent"\) continue/,
    );
  });

  it("3 mutation CTA + dropdown + 전체 해제 배선 보존", () => {
    expect(bar).toMatch(/onReviewStart/);
    expect(bar).toMatch(/onReminderStart/);
    expect(bar).toMatch(/onStatusChangeStart/);
    expect(bar).toMatch(/onRemoveOne\([\s\S]{0,50}\.id\)/);
    expect(bar).toMatch(/전체\s*해제/);
  });

  it("§quotes-mgmt-enhance §2 trace marker (bar + page)", () => {
    expect(bar).toMatch(/§quotes-mgmt-enhance §2/);
    expect(page).toMatch(/§quotes-mgmt-enhance §2/);
  });
});
