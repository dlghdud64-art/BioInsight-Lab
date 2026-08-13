/**
 * §onboarding-blocker #7 — 초대 UI 와 수락 화면은 **짝으로만 존재한다**
 *
 * 배경 (실측 2026-08-12):
 *   초대 생성 API 는 정상 동작해 `inviteUrl` 을 돌려주고, `settings/workspace` 가
 *   그 링크를 **클립보드에 복사**하며 *"링크 복사됨"* toast 를 띄웠다.
 *   그런데 수락 화면 `/invite/{token}` 이 **없다** — 받는 사람은 404 를 본다.
 *   `acceptedAt` · `acceptedByUserId` 를 쓰는 코드도 0 이고,
 *   `organizationMember` 생성 지점은 조직 생성 시 본인 upsert 하나뿐이다.
 *
 *   **관리자에게는 성공으로 보이고 받는 사람만 실패한다** —
 *   dead link + placeholder success 가 겹친 형태다.
 *
 * 계약 (짝 강제):
 *   I1. 수락 화면이 **없는 동안** 초대 생성 UI 를 렌더하지 않는다
 *   I2. 초대 링크를 **클립보드에 복사해 주지 않는다** (성공처럼 보이는 지점)
 *   I3. 수락 화면이 생기면 이 단언들을 **승계해야** UI 가 돌아온다 — I0 이 그것을 알린다
 *
 * ⚠️ 라우트(`api/organizations/[id]/invites`)는 **유지**한다. 생성 절반은 멀쩡하다.
 *   지우면 다시 만들어야 한다. 호출자 0 은 여기서 **의도된 미완**이다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** 수락 화면 후보 경로 — 어느 하나라도 생기면 짝이 성립한다. */
const ACCEPT_PAGES = [
  "src/app/invite/[token]/page.tsx",
  "src/app/invite/[token]/page.ts",
];
const acceptScreenExists = ACCEPT_PAGES.some((p) => existsSync(join(WEB_ROOT, p)));

const WORKSPACE = "src/app/settings/workspace/page.tsx";
const WORKSPACE_CODE = stripComments(read(WORKSPACE));
const ROUTE = "src/app/api/organizations/[id]/invites/route.ts";

describe("§invite-pairing I0 — 수집이 실제로 동작한다", () => {
  it("대상 소스가 읽힌다", () => {
    expect(WORKSPACE_CODE.length).toBeGreaterThan(2000);
    expect(existsSync(join(WEB_ROOT, ROUTE))).toBe(true);
  });

  it("🔔 수락 화면이 생기면 이 파일의 단언을 승계해야 한다", () => {
    // 이 it 은 상태 알림이다 — 화면이 생긴 순간 RED 가 되어
    // "이제 UI 를 되살려라 + 단언을 승계하라" 를 강제한다.
    expect(
      acceptScreenExists,
      "수락 화면이 생겼다. I1·I2 를 승계하고 초대 UI 를 복원할 것(§onboarding-blocker #7).",
    ).toBe(false);
  });
});

describe("§invite-pairing I1 — 수락 화면 없이 초대 UI 를 만들지 않는다", () => {
  it("초대 생성 버튼이 렌더되지 않는다 (disabled 아님 — 미생성)", () => {
    expect(WORKSPACE_CODE).not.toMatch(/초대 링크 생성<\/Button>/);
    expect(WORKSPACE_CODE).not.toMatch(/새 초대 링크 생성/);
    expect(WORKSPACE_CODE).not.toMatch(/활성 초대 링크/);
  });

  it("초대 URL 을 화면에 그리지 않는다", () => {
    expect(WORKSPACE_CODE).not.toMatch(/\/invite\/\$\{activeInvite\.token\}/);
  });

  it("만료 정책 안내도 없다 (있는 기능처럼 보이게 한다)", () => {
    expect(WORKSPACE_CODE).not.toMatch(/7일 후 만료됩니다/);
  });
});

describe("§invite-pairing I2 — 성공처럼 보이는 지점 0", () => {
  it("초대 링크를 클립보드에 복사하는 호출이 없다", () => {
    // 정의는 남아 있어도(승계 대상) **호출**은 0 이어야 한다.
    expect(WORKSPACE_CODE).not.toMatch(/onClick=\{\(\) => copyInviteLink\(/);
  });

  it("'링크 복사됨' toast 가 뜨는 경로가 렌더에 연결되지 않는다", () => {
    expect(WORKSPACE_CODE).not.toMatch(/onClick=\{handleCreateInviteLink\}/);
  });
});

describe("§invite-pairing I3 — 라우트는 유지하되 미완임이 기록돼 있다", () => {
  it("라우트 상단에 §onboarding-blocker #7 미완 주석이 있다", () => {
    // 주석 자체가 계약이므로 stripComments 하지 않은 원문을 본다.
    const raw = read(ROUTE);
    expect(raw).toMatch(/§onboarding-blocker #7/);
    expect(raw).toMatch(/수락 화면 `\/invite\/\{token\}` 이 존재하지 않는다/);
  });

  it("라우트가 삭제되지 않았다 (생성 절반은 멀쩡하다)", () => {
    const raw = read(ROUTE);
    expect(raw).toMatch(/export async function POST/);
  });
});
