/**
 * §billing-redesign P3: 현재 플랜 + 사용량 4지표 (호영님 핸드오프 2026-09-08).
 *
 * 닫는 결함 2건(배포본 실측):
 *   ① 기능 이중 나열 - 현재 플랜 카드의 "포함된 기능" 과 아래 플랜 카드가 같은 내용을
 *      두 번 말했다. 카드는 한도 1줄 요약만 지고, 기능은 비교표(P4)가 단일 소스다.
 *   ② 시트 1/1 이 꽉 찬 파랑이었다. 한도에 도달했는데 화면은 정상처럼 보였다.
 *
 * 색은 §11.302 신호등을 그대로 쓴다: 100% red / 80%+ 또는 시트 만석 yellow / 그 외 blue.
 *   Tailwind `amber-*`/`orange-*` 는 금지(16 amber-removed sentinel). 시안이 "앰버" 라
 *   불러도 클래스는 yellow 다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
/* 🛑 페이지 모듈을 import 하지 않는다. 2026-09-09 실측: sentinel 이 `@/app/billing/page` 를
 *   부르자 billing/page -> AppPageHeader -> dashboard/Header -> next-auth/react 로 이어져
 *   vitest 가 next-auth 를 해석하지 못해 게이트 전체가 RED 였다(next build 는 통과).
 *   규칙은 lib 순수모듈에서 검증하고, 화면은 "그 함수를 부르는지" 만 소스로 핀한다. */
import {
  usageTone,
  usageNote,
  billingPeriodLabel,
  formatBillingDate,
} from "@/lib/billing/usage-tone";
import { violations } from "../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PAGE = read("src/app/billing/page.tsx");
const LIB = read("src/lib/billing/usage-tone.ts");

describe("§billing-redesign P3: 게이지 신호등 규칙", () => {
  it("100% 도달 = danger", () => {
    expect(usageTone(3, 3)).toBe("danger");
    expect(usageTone(11, 10)).toBe("danger");
  });

  it("80% 이상 = warn, 그 미만 = normal", () => {
    expect(usageTone(8, 10)).toBe("warn");
    expect(usageTone(7, 10)).toBe("normal");
    expect(usageTone(0, 10)).toBe("normal");
  });

  it("시트 만석은 100% 미만이어도 warn (초대가 막히는 상태)", () => {
    expect(usageTone(1, 2, true)).toBe("warn");
  });

  it("무제한(limit null)은 normal - 채울 수 없는 막대는 거짓 신호다", () => {
    expect(usageTone(999, null)).toBe("normal");
    expect(usageTone(5, 0)).toBe("normal");
  });
});

describe("§billing-redesign P3: 기간 표기", () => {
  it("이번 달 1일 ~ 말일, 날짜 표기 `YYYY. M. D.`", () => {
    const p = billingPeriodLabel(new Date(2026, 8, 8));
    expect(p.range).toBe("2026. 9. 1. ~ 2026. 9. 30.");
    expect(formatBillingDate(new Date(2026, 0, 5))).toBe("2026. 1. 5.");
  });

  it("초기화 남은 일수 = 다음 달 1일까지", () => {
    expect(billingPeriodLabel(new Date(2026, 8, 8)).resetInDays).toBe(23);
    expect(billingPeriodLabel(new Date(2026, 8, 30)).resetInDays).toBe(1);
  });

  it("초기화 날짜 라벨 = 다음 달 1일", () => {
    expect(billingPeriodLabel(new Date(2026, 8, 8)).resetDateLabel).toBe("2026. 10. 1.");
  });
});

describe("§billing-redesign P3: 다음 행동 문장", () => {
  it("한도 도달은 초기화일과 업그레이드를 함께 말한다", () => {
    expect(usageNote("danger", { kind: "요청", resetDateLabel: "2026. 10. 1." })).toBe(
      "한도 도달 · 다음 요청은 2026. 10. 1. 또는 업그레이드",
    );
  });

  it("시트는 초기화가 없다 - 안내가 다르다", () => {
    expect(usageNote("warn", { kind: "초대", resetDateLabel: "2026. 10. 1.", isSeat: true })).toBe(
      "멤버 초대 시 시트 추가 필요",
    );
  });

  it("normal 은 문장 없음 - 사유 없는 경보를 만들지 않는다", () => {
    expect(usageNote("normal", { kind: "요청", resetDateLabel: "2026. 10. 1." })).toBeNull();
  });
});

describe("§billing-redesign P3: 화면 계약", () => {
  it("기능 이중 나열 제거 - 플랜 카드에 '포함된 기능' 0", () => {
    expect(PAGE).not.toMatch(/포함된 기능/);
  });

  it("4지표 전부 렌더 (재고·스캔은 P1 에서 API 가 낸 값)", () => {
    expect(PAGE).toMatch(/label: "견적 요청"/);
    expect(PAGE).toMatch(/label: "운영자 시트"/);
    expect(PAGE).toMatch(/label: "재고 품목"/);
    expect(PAGE).toMatch(/label: "라벨 스캔"/);
    expect(PAGE).toMatch(/usage\?\.itemsUsed/);
    expect(PAGE).toMatch(/usage\?\.labelScansUsed/);
  });

  it("게이지 색 정본은 lib, amber/orange 0", () => {
    expect(LIB).toMatch(/danger: "bg-red-600"/);
    expect(LIB).toMatch(/warn: "bg-yellow-500"/);
    expect(LIB).toMatch(/normal: "bg-blue-600"/);
    expect(LIB).not.toMatch(/\bamber-\d|\borange-\d/);
    expect(PAGE).not.toMatch(/\bamber-\d|\borange-\d/);
  });

  it("화면은 규칙을 복제하지 않고 lib 함수를 부른다", () => {
    expect(PAGE).toMatch(/from "@\/lib\/billing\/usage-tone"/);
    expect(PAGE).toMatch(/usageTone\(r\.used, r\.limit, r\.seatFull\)/);
    expect(PAGE).toMatch(/usageNote\(tone, \{/);
    expect(PAGE).toMatch(/USAGE_BAR\[m\.tone\]/);
    // 규칙 재구현 0: 임계값·색 문자열이 페이지에 다시 나타나면 두 곳이 갈라진다.
    expect(PAGE).not.toMatch(/pct >= 100|pct >= 80/);
    expect(PAGE).not.toMatch(/danger: "bg-red-600"/);
  });

  it("업그레이드 CTA 는 실동작 (dead button 0)", () => {
    // P4b 승격: 라벨은 고정 문자열이 아니라 현재 플랜에서 파생된다.
    //   고정 "Basic" 을 핀하면 Basic 계정에서 자기모순인 구현이 GREEN 으로 남는다(prod 실측).
    expect(PAGE).toMatch(/\{planLabel\(upgradeNext\)\}으로 업그레이드/);
    // 앵커는 JSX 표현식 그대로 — 맨 문자열 "으로 업그레이드" 는 위쪽 주석에도 있다.
    const idx = PAGE.indexOf("{planLabel(upgradeNext)}으로 업그레이드");
    expect(idx).toBeGreaterThan(-1);
    // 창은 여는 태그부터(4원칙 ②) — 고정 폭으로 열지 않는다.
    const btn = PAGE.slice(PAGE.lastIndexOf("<Button", idx), idx);
    // P5 승격: 임시 /support 라우팅 → 업그레이드 요청 모달. 명제(실동작)는 그대로.
    expect(btn).toMatch(/onClick=\{\(\) => setUpgradeTarget\(planLabel\(upgradeNext\)\)\}/);
    expect(btn).not.toMatch(/disabled\s*$/m);
  });

  it("em dash 조항: 화면 노출 문구에 구분자 0 (주석 제외 - 판별기 규약)", () => {
    expect(violations(PAGE)).toHaveLength(0);
  });
});
