/**
 * §11.266b → §dashboard-home-redesign #dashboard-action-touch-target (재배치/정합)
 *
 * §11.266b 는 dashboard page.tsx 의 recommendedActions("다음 작업") 인라인 렌더
 * button 이 44x44(min-h-[44px]) 를 만족하도록 강제했다. 이후 §dashboard-home-redesign
 * / §dashboard-mobile-v2 에서 "다음 작업" 인라인 렌더가 **ActionInbox("오늘 처리해야
 * 할 일") / MobileDashboardView 로 대체**되었다. recommendedActions 인라인 map 은
 * 소멸했고(page.tsx 배열은 잔존하나 렌더 미참조), 44x44 표준의 본 의도는 이제
 * ActionInbox 행이 소유한다.
 *
 * 본 sentinel 은 그 최신 truth 로 정합 — 44px 터치 표준을 **살아있는 표면(ActionInbox)**
 * 에서 계속 강제하고, 구 인라인 렌더 소멸을 회귀 가드로 잠근다.
 *   - Apple HIG / Material / WCAG 2.1 SC 2.5.5 Target Size 표준 유지
 * ⚠ 죽은 recommendedActions 인라인 렌더 재도입 금지(재설계 되돌림).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const INBOX_PATH = resolve(
  __dirname,
  "../../components/dashboard/action-inbox.tsx",
);
const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const inbox = readFileSync(INBOX_PATH, "utf8");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§dashboard-action-touch-target #1 — ActionInbox 행 44x44 (살아있는 표면)", () => {
  it("ActionInbox 행 min-h-[44px] + hover:bg-slate-50 transition-colors", () => {
    expect(inbox).toMatch(
      /min-h-\[44px\] hover:bg-slate-50 transition-colors/,
    );
  });

  it("count>0 항목만 렌더 (dead button 0)", () => {
    expect(inbox).toMatch(/items\.filter\(\(it\) => it\.count > 0\)/);
  });

  it("ChevronRight 액션 아이콘 보존", () => {
    expect(inbox).toMatch(/<ChevronRight/);
  });
});

describe("§dashboard-action-touch-target #2 — 구 인라인 렌더 소멸 회귀 가드", () => {
  it("recommendedActions 인라인 map 렌더 부재 (§dashboard-home-redesign 대체)", () => {
    expect(page).not.toMatch(/recommendedActions\.map/);
  });

  it("urgentItems 모바일 블록 부재 (§dashboard-dedup, ActionInbox 중복 제거)", () => {
    expect(page).not.toMatch(/urgentItems\.map/);
  });
});
