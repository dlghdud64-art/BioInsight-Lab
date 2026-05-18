/**
 * §11.250-pref-silence — 알림 방해 금지 시간 (push silence window) backend infra.
 *
 * 호영님 spec: 사용자 시간대 (예: 22:00 ~ 08:00) push notification 차단.
 *   - in-app notification (NotificationAction) 은 영향 0 — 사용자가 dashboard
 *     안 확인. silence 는 push 만 차단 (즉시 발화 → 사용자 방해).
 *
 * Schema: User.preferences Json — 기존 §11.230c (a) reuse.
 *   silenceWindow: { enabled: boolean, start: "HH:mm", end: "HH:mm" }
 *
 * canonical truth lock:
 *   - User.preferences Json field reuse (schema 0).
 *   - push-sender 안 isUserPreferenceAllowed 다음에 silence check 추가.
 *   - graceful fallback — DB fail / invalid format / silenceWindow 미설정 시
 *     전체 통과 (default off).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const HELPER_PATH = resolve(__dirname, "../../../lib/notifications/silence-window.ts");
const PUSH_PATH = resolve(__dirname, "../../../lib/notifications/push-sender.ts");
const helperCode = safeRead(HELPER_PATH);
const pushCode = safeRead(PUSH_PATH);

describe("§11.250-pref-silence #1 — silence-window helper", () => {
  it("§11.250-pref-silence trace marker", () => {
    expect(helperCode).toMatch(/§11\.250-pref-silence|11\.250-pref-silence/);
  });

  it("isWithinSilenceWindow export", () => {
    expect(helperCode).toMatch(/export\s+(async\s+)?function\s+isWithinSilenceWindow|export\s+const\s+isWithinSilenceWindow/);
  });

  it("isUserInSilenceWindow async (DB user lookup)", () => {
    // userId 받아서 preferences 조회 + isWithinSilenceWindow 호출.
    expect(helperCode).toMatch(/export\s+async\s+function\s+isUserInSilenceWindow|export\s+const\s+isUserInSilenceWindow/);
  });

  it("preferences.silenceWindow 접근", () => {
    expect(helperCode).toMatch(/silenceWindow/);
  });

  it("enabled / start / end shape 처리", () => {
    expect(helperCode).toMatch(/enabled/);
    expect(helperCode).toMatch(/(start|end)/);
  });

  it("graceful fallback — invalid format 시 false (= silence off)", () => {
    // try/catch 또는 명시 fallback.
    expect(helperCode).toMatch(/(try|catch|return\s+false)/);
  });
});

describe("§11.250-pref-silence #2 — push-sender silence check 통합", () => {
  it("push-sender silence-window import 또는 isUserInSilenceWindow 사용", () => {
    expect(pushCode).toMatch(/isUserInSilenceWindow|silence-window/);
  });

  it("§11.250-pref-silence trace marker (push-sender)", () => {
    expect(pushCode).toMatch(/§11\.250-pref-silence|11\.250-pref-silence/);
  });
});

describe("§11.250-pref-silence — invariant 보존", () => {
  it("push-sender isUserPreferenceAllowed 호출 보존 (§11.250-pref-push)", () => {
    expect(pushCode).toMatch(/isUserPreferenceAllowed/);
  });

  it("push-sender silent fallback try/catch 보존", () => {
    expect(pushCode).toMatch(/(try|catch)/);
  });

  it("helper preferences Json field reuse (User.preferences)", () => {
    expect(helperCode).toMatch(/preferences/);
  });
});
