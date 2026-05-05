/**
 * #notification-inapp-helper-drift-sync — RED→GREEN test
 *
 * web (apps/web/src/lib/notifications/event-category-map.ts) 와
 * mobile (apps/mobile/lib/event-category-map.ts) 의 helper drift 자동
 * 차단. monorepo packages workspace 외 mobile (Expo 별도 npm install)
 * 정합 — 두 file 그대로 유지 + grep based logic sync 검증.
 *
 * Scope:
 *   - eventTypeToCategory 의 18 eventType case 분기 양쪽 존재
 *   - 7 카테고리 enum 정합 (string literal)
 *   - 한국어 라벨 정합 (결재 lifecycle 3 + 재고 + 견적 + 주문 + system)
 *   - formatNotificationTime 한국어 분기 정합
 *
 * Out of scope:
 *   - buildNotificationHref drift (의도적 라우터 경로 차이 — `/dashboard/quotes`
 *     vs `/quotes/[id]`)
 *   - helper logic runtime 동등성 (grep based — 정합 100% 보장 0)
 *   - file size / hash 비교 (fragile)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// __dirname = apps/web/src/__tests__/lib/notifications — 5단계 up = apps/web,
// 7단계 up = repo root
const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..", "..");
const WEB_HELPER = "src/lib/notifications/event-category-map.ts";
const MOBILE_HELPER = "apps/mobile/lib/event-category-map.ts";

function readWeb(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function readRepo(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#notification-inapp-helper-drift-sync — eventType case set 정합", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  const eventTypes = [
    // 결재 lifecycle (3 신규 + APPROVAL_NEEDED generic)
    "PURCHASE_APPROVAL_REQUESTED",
    "PURCHASE_APPROVED",
    "PURCHASE_REJECTED",
    "APPROVAL_NEEDED",
    // 재고
    "INVENTORY_LOW",
    "INVENTORY_EXPIRING",
    "INVENTORY_RECEIVED",
    // 견적
    "QUOTE_REQUESTED",
    "QUOTE_RECEIVED",
    "QUOTE_EXPIRED",
    "VENDOR_REPLIED",
    "FAST_TRACK_ELIGIBLE",
    // 주문
    "ORDER_DELIVERED",
    "ORDER_PLACED",
    "ORDER_SHIPPED",
    // 비교·에스컬레이션·예산
    "COMPARE_COMPLETED",
    "ESCALATION_TRIGGERED",
    "BUDGET_WARNING",
  ];

  it.each(eventTypes)(
    "eventType '%s' 가 web + mobile 양쪽 case 분기 존재 (drift 0)",
    (type) => {
      const pattern = new RegExp(`case\\s+["']${type}["']`);
      expect(webSrc).toMatch(pattern);
      expect(mobileSrc).toMatch(pattern);
    },
  );
});

describe("#notification-inapp-helper-drift-sync — 7 카테고리 enum 정합", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  const categories = [
    "stock_alert",
    "quote_arrived",
    "delivery_complete",
    "approval_pending",
    "expiry_warning",
    "safety_alert",
    "system",
  ];

  it.each(categories)(
    "category '%s' 가 web + mobile 양쪽 string literal 존재",
    (cat) => {
      const pattern = new RegExp(`["']${cat}["']`);
      expect(webSrc).toMatch(pattern);
      expect(mobileSrc).toMatch(pattern);
    },
  );
});

describe("#notification-inapp-helper-drift-sync — buildNotificationText 한국어 라벨 정합", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  const koreanLabels = [
    // 결재 lifecycle
    "결재 요청 도착",
    "결재 승인 완료",
    "결재 반려",
    // 견적
    "견적서 수신",
    "견적 요청 접수",
    "견적 만료",
    "공급사 응답 도착",
    "즉시 승인 가능 권장",
    // 재고
    "재고 부족",
    "유효기한 임박",
    "입고 완료",
    // 주문
    "주문 생성",
    "주문 배송 시작",
    "주문 배송 완료",
    // 기타
    "비교 분석 완료",
    "승인 요청 도착",
    "에스컬레이션 발생",
    "예산 경고",
  ];

  it.each(koreanLabels)(
    "한국어 라벨 '%s' web + mobile 양쪽 정합",
    (label) => {
      expect(webSrc).toContain(label);
      expect(mobileSrc).toContain(label);
    },
  );
});

describe("#notification-inapp-helper-drift-sync — formatNotificationTime 분기 정합", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  const timeBranches = ["방금 전", "분 전", "시간 전", "어제", "일 전"];

  it.each(timeBranches)(
    "시간 분기 '%s' web + mobile 양쪽 정합",
    (branch) => {
      expect(webSrc).toContain(branch);
      expect(mobileSrc).toContain(branch);
    },
  );
});

describe("#notification-inapp-helper-drift-sync — 4 helper export 정합", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  const helpers = [
    "eventTypeToCategory",
    "buildNotificationText",
    "buildNotificationHref",
    "formatNotificationTime",
  ];

  it.each(helpers)(
    "helper '%s' export web + mobile 양쪽 정합",
    (fn) => {
      const pattern = new RegExp(`export\\s+function\\s+${fn}`);
      expect(webSrc).toMatch(pattern);
      expect(mobileSrc).toMatch(pattern);
    },
  );

  it("NotificationCategory type 양쪽 export", () => {
    expect(webSrc).toMatch(/export\s+type\s+NotificationCategory/);
    expect(mobileSrc).toMatch(/export\s+type\s+NotificationCategory/);
  });
});

describe("#notification-inapp-helper-drift-sync — drift sync 정책 코멘트 명시", () => {
  const webSrc = readWeb(WEB_HELPER);
  const mobileSrc = readRepo(MOBILE_HELPER);

  it("web helper 가 mobile 복제 정책 명시 또는 §11.209d-notification 코멘트 포함", () => {
    expect(webSrc).toMatch(/§11\.209d-notification|11\.209d-notification/);
  });

  it("mobile helper 가 web canonical 참조 코멘트 포함 (drift 차단 lock)", () => {
    // mobile 은 web 의 single source 참조 명시 — drift 시 두 file 동시 수정 강제
    expect(mobileSrc).toMatch(/§11\.209d-notification|11\.209d-notification/);
    // mobile 복제임을 명시 (web event-category-map.ts 또는 동일 source 표기)
    expect(mobileSrc).toMatch(/web|apps\/web|동일 source|복제/);
  });
});
