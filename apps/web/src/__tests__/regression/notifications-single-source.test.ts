/**
 * §notifications-single-source (2026-09-22 · 호영님 P0) · **알림 센터는 종 아이콘과 같은 출처만 보여준다.**
 *
 * ── 왜 (지금까지 찾은 것 중 가장 위험한 형태 · 호영님) ──
 * /dashboard/notifications 가 코드에 박힌 가짜 알림 20건을 띄웠다. 세 가지가 겹쳤다:
 *   ⓐ 행동 지시형 — 「재고 부족 · FBS 남은 수량 5개 · 재주문 검토 필요」 처럼 수치를 대고 행동을 시켰다
 *   ⓑ 권한·과금 축까지 거짓 — 실존하지 않는 「이준구」 의 역할 승격 · 「Owner 권한 이전 요청」 ·
 *      있지도 않은 「Business 플랜」 결제 완료
 *   ⓒ 상대 시각 — 새로고침할 때마다 「10분 전」 으로 갱신돼 방금 온 것처럼 보였다
 * 그리고 헤더 종은 0, 알림 센터는 18 — 같은 개념의 출처가 둘이었다.
 * §11.209d 가 종의 mock 을 걷어낼 때 알림 센터는 **형제 슬롯**으로 남았다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 가짜 알림이 돌아오지 않는다(역계약) — 품목명(FBS·Ethanol·DMEM) · 「이준구」 · 「Owner 권한 이전」 ·
 *      「Business 플랜」 · INITIAL_NOTIFICATIONS · 「Mock 데이터」 (알림 센터 + 헤더, 주석 제거본)
 *   ② 단일 출처 — 알림 센터와 헤더가 같은 훅 `useInAppNotifications()` 를 부른다.
 *      목록 fetch 는 그 훅 한 곳에만 있다.
 *   ③ 빈 상태는 「새 알림 없음」 한 줄 — 「왜·어디서」 설명을 붙이지 않는다(알림은 없는 게 정상).
 *   ④ 저장 없이 로컬 상태만 바꾸는 읽음 처리 0 (placeholder success 제거).
 *
 * ── 자기 한계 ──
 *   1. 이 파일은 "같은 출처" 만 보고, 그 출처가 살아 있는지는 보지 않는다.
 *      → 출처(라우트 · 수신자 범위 · 미읽음 · 읽음 소유 확인)는 notifications-route.test.ts 가 문다(2026-09-22 · 404 해소).
 *   2. 오류와 0건을 구분하지 않는다(종과 같은 동작 · 호영님 "단일 상태" 지시).
 *   3. 알림 센터·헤더 밖. 품목명은 카탈로그·검색에서 정당하게 쓰이므로 전역 금지하지 않았다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const PAGE = "app/dashboard/notifications/page.tsx";
const HEADER = "components/dashboard/Header.tsx";
const HOOK = "lib/notifications/use-in-app-notifications.ts";

describe("§notifications-single-source · 알림 센터는 종 아이콘과 같은 출처만", () => {
  it("① 가짜 알림이 돌아오지 않는다 (역계약 · 알림 센터 + 헤더)", () => {
    for (const rel of [PAGE, HEADER]) {
      const src = code(rel);
      expect(src, `${rel}: 품목명`).not.toMatch(/\bFBS\b|Ethanol 99\.5%|\bDMEM\b/);
      expect(src, `${rel}: 가상 인물`).not.toMatch(/이준구/);
      expect(src, `${rel}: 권한 이전`).not.toMatch(/Owner 권한 이전/);
      expect(src, `${rel}: 가상 구독`).not.toMatch(/Business 플랜/);
      expect(src, `${rel}: mock 상수`).not.toMatch(/\bINITIAL_NOTIFICATIONS\b/);
      expect(src, `${rel}: mock 표지`).not.toMatch(/Mock 데이터/);
    }
  });

  it("② 단일 출처 · 두 화면이 같은 훅을 부르고, 목록 fetch 는 훅 한 곳", () => {
    expect(code(PAGE)).toMatch(/\buseInAppNotifications\(\)/);
    expect(code(HEADER)).toMatch(/\buseInAppNotifications\(\)/);
    expect(code(HOOK)).toMatch(/fetch\("\/api\/notifications\?actionType=IN_APP/);
    // 목록 fetch 가 화면 쪽에 다시 생기면 출처가 둘이 된다
    expect(code(PAGE)).not.toMatch(/fetch\("\/api\/notifications\?/);
    expect(code(HEADER)).not.toMatch(/fetch\("\/api\/notifications\?/);
  });

  it("③ 빈 상태는 「새 알림 없음」 한 줄 (설명 없음)", () => {
    const src = code(PAGE);
    const from = src.indexOf("notifications.length === 0 ?");
    const to = src.indexOf(") : (", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const empty = src.slice(from, to);
    expect(empty).toMatch(/새 알림 없음/);
    expect((empty.match(/<p\b/g) ?? []).length).toBe(1);
  });

  it("④ 저장 없이 로컬 상태만 바꾸는 읽음 처리 0", () => {
    const src = code(PAGE);
    expect(src).not.toMatch(/\bsetNotifications\(/);
    expect(src).not.toMatch(/\bmarkAllRead\b/);
    expect(src).not.toMatch(/\btoggleRead\b/);
  });
});
