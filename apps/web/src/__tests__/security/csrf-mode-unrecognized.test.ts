/**
 * §csrf-mode-unrecognized (2026-09-21) · CSRF rollout mode 해석 계약.
 *
 * 배경: 이전 구현은 인식 못 하는 env 값을 조용히 report_only 로 떨어뜨렸다.
 *   같은 Vercel 프로젝트에 글자 하나 빠진 ABAXIS_CSRF_MODE 가 실제로 앉아 있었으므로
 *   오타는 가설이 아니라 실증이다. 오타난 값 = 보호 없음 + 아무도 모름.
 *
 * 🛑 이 계약은 "던진다" 가 아니다. 이 함수는 미들웨어가 요청마다 부른다 ·
 *   던지면 오타 하나가 프로덕션 전체를 500 으로 만든다. 가드가 제품을 죽이면 더 큰 결함이다.
 *   그래서 모드는 안전한 기본값에 머물되, 인식 실패 사실을 잃지 않는다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..", "lib", "security", "csrf-contract.ts");
const ROUTE = join(__dirname, "..", "..", "app", "api", "security", "csrf-status", "route.ts");
const read = (p: string) => readFileSync(p, "utf8");

const ORIGINAL = process.env.LABAXIS_CSRF_MODE;

async function resolveWith(value: string | undefined) {
  if (value === undefined) delete process.env.LABAXIS_CSRF_MODE;
  else process.env.LABAXIS_CSRF_MODE = value;
  vi.resetModules();
  const mod = await import("@/lib/security/csrf-contract");
  return mod.resolveCsrfRolloutMode();
}

describe("§csrf-mode-unrecognized · 모드 해석", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL === undefined) delete process.env.LABAXIS_CSRF_MODE;
    else process.env.LABAXIS_CSRF_MODE = ORIGINAL;
  });

  it("미설정은 결함이 아니다 · report_only 이고 recognized 다", async () => {
    expect(await resolveWith(undefined)).toEqual({
      mode: "report_only",
      envPresent: false,
      recognized: true,
    });
  });

  /*
   * envPresent 는 "키가 있는가", recognized 는 "그 값이 먹는가" — 둘은 다른 질문이다.
   * 빈 값·공백을 미설정으로 접으면, Vercel env 목록에는 키가 있는데 상태 엔드포인트는
   * "설정 안 됨" 이라 말한다. 이 변경의 목적과 정면으로 어긋난다.
   * (이 단언은 2026-09-21 에 뒤집혔다. 처음 쓴 "공백은 미설정과 같다" 가 틀렸다.)
   */
  it("🛑 공백만 있는 값은 미설정이 아니다 · 넣긴 넣었는데 먹지 않는 상태다", async () => {
    expect(await resolveWith("   ")).toEqual({
      mode: "report_only",
      envPresent: true,
      recognized: false,
    });
  });

  it("🛑 빈 문자열도 같다 · 키는 있고 값이 비었다", async () => {
    expect(await resolveWith("")).toEqual({
      mode: "report_only",
      envPresent: true,
      recognized: false,
    });
  });

  it("미설정과 빈 값은 서로 다른 상태로 구분된다", async () => {
    const absent = await resolveWith(undefined);
    const blank = await resolveWith("");
    expect(absent.mode).toBe(blank.mode);
    expect(absent.envPresent).not.toBe(blank.envPresent);
    expect(absent.recognized).not.toBe(blank.recognized);
  });

  it("허용값 셋은 그대로 산다", async () => {
    for (const mode of ["report_only", "soft_enforce", "full_enforce"] as const) {
      expect(await resolveWith(mode)).toEqual({
        mode,
        envPresent: true,
        recognized: true,
      });
    }
  });

  it("🛑 앞뒤 공백이 붙은 허용값은 이전과 같이 report_only · 배포만으로 prod 모드가 바뀌지 않는다", async () => {
    // 이전 구현은 완전 일치만 인정했다. trim 해서 고르면 공백 붙은 prod 값이 이 배포로 조용히 켜진다.
    for (const padded of [" soft_enforce", "full_enforce\n", " report_only "]) {
      expect(await resolveWith(padded)).toEqual({
        mode: "report_only",
        envPresent: true,
        recognized: false,
      });
    }
  });

  it("🛑 비어 있지 않은데 인식 못 하는 값은 조용히 통과하지 않는다", async () => {
    const r = await resolveWith("soft-enforce");
    expect(r.mode).toBe("report_only");
    expect(r.envPresent).toBe(true);
    expect(r.recognized).toBe(false);
  });

  it("🛑 던지지 않는다 · 미들웨어가 요청마다 부르는 함수다", async () => {
    await expect(resolveWith("typo_value")).resolves.toBeTruthy();
    await expect(resolveWith("FULL_ENFORCE")).resolves.toMatchObject({ recognized: false });
  });

  it("인식 실패는 console.error 로 남는다 · 휘발이 아닌 유일한 싱크다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await resolveWith("nope");
    expect(spy).toHaveBeenCalledTimes(1);
    const msg = String(spy.mock.calls[0]?.[0] ?? "");
    expect(msg).toContain("LABAXIS_CSRF_MODE");
    expect(msg).toContain("해소:");
  });

  it("원문 값은 로그에 싣지 않는다 · Vercel 에 sensitive 로 보관된 값이다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await resolveWith("secret_looking_value");
    const msg = String(spy.mock.calls[0]?.[0] ?? "");
    expect(msg).not.toContain("secret_looking_value");
  });
});

describe("§csrf-mode-unrecognized · 관측 경로", () => {
  it("상태 엔드포인트가 recognized 를 노출한다", () => {
    const route = read(ROUTE);
    expect(route).toMatch(/resolveCsrfRolloutMode\(\)/);
    expect(route).toMatch(/recognized:\s*resolution\.recognized/);
    expect(route).toMatch(/present:\s*resolution\.envPresent/);
  });

  it("🛑 정본이 던지는 형태로 되돌아가지 않는다", () => {
    const src = read(SRC);
    const fn = src.slice(src.indexOf("export function resolveCsrfRolloutMode"));
    const body = fn.slice(0, fn.indexOf("export function getCsrfRolloutMode"));
    expect(body).not.toMatch(/throw\s+new\s+Error/);
  });
});
