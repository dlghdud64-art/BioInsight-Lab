/**
 * §billing-redesign P5: 업그레이드 요청 모달 (호영님 핸드오프 2026-09-08 · 추가 요구 2건).
 *
 * 닫는 결함: "결제 연동 준비 중" 인데 업그레이드 버튼이 활성 dead button 이었다.
 *   결제 전까지 이 버튼의 실제 역할은 영업팀 연락이고, 그 인입은 이미
 *   `POST /api/support/inquiry` 가 받는다. 새 경로를 파면 수신함이 둘로 갈라진다.
 *
 * 호영님 추가 요구 2건이 이 파일의 핵심 단언이다:
 *   ① 429(5분 중복)·400 을 성공 토스트로 덮지 말 것 (placeholder success 금지)
 *   ② 세션 값 prefill + 수정 가능. 클라이언트 검증은 **서버가 실제로 거절하는 것**과 같을 것
 *
 * 그래서 route.ts 소스를 함께 읽어 두 규칙이 갈라지지 않았는지 대조한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UPGRADE_INQUIRY_TYPE,
  MESSAGE_MIN_LENGTH,
  buildUpgradeMessage,
  describeUpgradeFailure,
  validateUpgradeRequest,
} from "@/lib/billing/upgrade-request";
import { violations } from "../_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PAGE = read("src/app/billing/page.tsx");
const DIALOG = read("src/components/billing/upgrade-request-dialog.tsx");
const ROUTE = read("src/app/api/support/inquiry/route.ts");
const LIB = read("src/lib/billing/upgrade-request.ts");

describe("§billing-redesign P5: 서버 계약과 같은 검증", () => {
  it("inquiryType 은 'pricing' 리터럴 고정 (폴백에 삼켜지지 않게)", () => {
    expect(UPGRADE_INQUIRY_TYPE).toBe("pricing");
    // 라우트가 허용 목록에 실제로 갖고 있는 값이어야 한다.
    expect(ROUTE).toMatch(/VALID_INQUIRY_TYPES = \[[^\]]*"pricing"/);
    // 미허용 값은 조용히 service 로 폴백한다 = 오타가 에러 없이 잘못 분류된다.
    expect(ROUTE).toMatch(/: "service"/);
    expect(DIALOG).toMatch(/inquiryType: UPGRADE_INQUIRY_TYPE/);
  });

  it("message 하한이 서버와 같다", () => {
    expect(MESSAGE_MIN_LENGTH).toBe(10);
    expect(ROUTE).toMatch(/message\.trim\(\)\.length < 10/);
  });

  it("name·email·message 거절 조건이 서버와 같다", () => {
    expect(validateUpgradeRequest({ name: "  ", email: "a@b.c", message: "x".repeat(10) })).toEqual({
      ok: false,
      field: "name",
      reason: "이름 또는 기관명을 입력해 주세요.",
    });
    expect(validateUpgradeRequest({ name: "홍길동", email: "nope", message: "x".repeat(10) }).ok).toBe(false);
    expect(validateUpgradeRequest({ name: "홍길동", email: "a@b.c", message: "짧음" }).ok).toBe(false);
    expect(validateUpgradeRequest({ name: "홍길동", email: "a@b.c", message: "x".repeat(10) })).toEqual({ ok: true });
    // 서버 문구와 같은 말을 한다(사용자가 두 번 다른 이유를 듣지 않게).
    expect(ROUTE).toContain("이름 또는 기관명을 입력해 주세요.");
    expect(ROUTE).toContain("올바른 이메일 주소를 입력해 주세요.");
  });

  it("기본 문구는 항상 하한을 넘긴다 (빈 상자를 주고 거절당하게 두지 않는다)", () => {
    const m = buildUpgradeMessage("Basic");
    expect(m.trim().length).toBeGreaterThanOrEqual(MESSAGE_MIN_LENGTH);
    expect(m).toContain("Basic");
    expect(buildUpgradeMessage("Pro", "T1")).toContain("T1");
    expect(validateUpgradeRequest({ name: "n", email: "a@b.c", message: m }).ok).toBe(true);
  });
});

describe("§billing-redesign P5: 실패를 성공으로 덮지 않는다", () => {
  it("429 는 중복 차단 사유를 말한다", () => {
    expect(describeUpgradeFailure(429)).toContain("5분");
    expect(ROUTE).toMatch(/status: 429/);
    expect(ROUTE).toContain("5분 이내 중복 문의는 제한됩니다");
  });

  it("서버가 준 사유가 있으면 그대로 쓴다", () => {
    expect(describeUpgradeFailure(400, "문의 내용을 10자 이상 입력해 주세요.")).toBe(
      "문의 내용을 10자 이상 입력해 주세요.",
    );
    expect(describeUpgradeFailure(500, "   ")).toContain("접수하지 못했습니다");
  });

  it("모달은 !res.ok 에서 return 한다 (성공 토스트 도달 0)", () => {
    const idx = DIALOG.indexOf("if (!res.ok)");
    expect(idx).toBeGreaterThan(-1);
    /* 창은 블록 끝(첫 `return;`)까지다. 고정 길이로 자르면 창이 블록을 넘어
       성공 경로의 toast 까지 삼켜, 옳은 코드에서 단언이 실패한다(2026-09-10 실측). */
    const branchEnd = DIALOG.indexOf("return;", idx);
    expect(branchEnd).toBeGreaterThan(idx);
    const branch = DIALOG.slice(idx, branchEnd + "return;".length);
    expect(branch).toMatch(/setError\(describeUpgradeFailure\(res\.status/);
    expect(branch).toMatch(/return;/);
    expect(branch).not.toMatch(/toast\(/);
  });

  it("실패 사유는 모달 안에 남는다 (토스트만 쓰면 사유가 사라진다)", () => {
    expect(DIALOG).toMatch(/role="alert"/);
    expect(DIALOG).toMatch(/\{error\}/);
  });
});

describe("§billing-redesign P5: prefill 과 배선", () => {
  it("세션 값 prefill, 사용자가 수정 가능", () => {
    expect(DIALOG).toMatch(/setName\(defaultName\?\.trim\(\) \|\| ""\)/);
    expect(DIALOG).toMatch(/setEmail\(defaultEmail\?\.trim\(\) \|\| ""\)/);
    expect(DIALOG).toMatch(/onChange=\{\(e\) => setName\(e\.target\.value\)\}/);
    expect(DIALOG).toMatch(/onChange=\{\(e\) => setEmail\(e\.target\.value\)\}/);
    expect(PAGE).toMatch(/defaultName=\{session\?\.user\?\.name\}/);
    expect(PAGE).toMatch(/defaultEmail=\{session\?\.user\?\.email\}/);
  });

  it("CTA 3곳이 같은 모달로 간다 (임시 /support 라우팅 0)", () => {
    expect(PAGE).not.toMatch(/router\.push\("\/support"\)/);
    expect(PAGE).toMatch(/setUpgradeTarget\("Enterprise"\)/); // 헤더(§billing-cta-plan-aware)
    // P4b 승격: 플랜 카드 CTA 의 대상은 현재 플랜에서 파생된다(고정 "Basic" 아님).
    expect(PAGE).toMatch(/setUpgradeTarget\(planLabel\(upgradeNext\)\)/);
    expect(PAGE).toMatch(/setUpgradeTarget\(planLabel\(plan\)\)/);
    expect(PAGE).toMatch(/<UpgradeRequestDialog/);
  });

  it("새 수신 경로를 파지 않는다 (기존 inquiry 재사용)", () => {
    expect(DIALOG).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(DIALOG).not.toMatch(/\/api\/billing\/upgrade|\/api\/sales/);
  });

  it("em dash 조항: 화면 문구 구분자 0", () => {
    expect(violations(DIALOG)).toHaveLength(0);
    expect(violations(LIB)).toHaveLength(0);
    expect(violations(PAGE)).toHaveLength(0);
  });
});
