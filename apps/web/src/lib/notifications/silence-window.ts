/**
 * §11.250-pref-silence — 알림 방해 금지 시간 (push silence window).
 *
 * 호영님 spec: 사용자 시간대 (예: 22:00 ~ 08:00) push notification 차단.
 *   - in-app notification (NotificationAction) 은 영향 0 — 사용자가 dashboard
 *     안 확인. silence 는 push 만 차단 (즉시 발화 → 사용자 방해).
 *   - timezone: 한국 (Asia/Seoul, KST) 강제 — 운영자 전원 한국 기반.
 *
 * Schema: User.preferences Json — §11.230c (a) cluster 와 일관.
 *   silenceWindow: { enabled: boolean, start: "HH:mm", end: "HH:mm" }
 *
 * Overnight window 처리:
 *   - start < end (예: 12:00 ~ 14:00) → 그 사이 시각만 silence (낮시간).
 *   - start > end (예: 22:00 ~ 08:00) → start ~ 24:00 OR 00:00 ~ end (밤시간).
 *
 * Graceful fallback:
 *   - preferences 미설정 / silenceWindow 미설정 → false (silence off, push 정상).
 *   - enabled false → false.
 *   - invalid format (HH:mm 아님) → false.
 *   - DB 조회 실패 → false (push 정상 전송 보장).
 */

import { db } from "@/lib/db";

interface SilenceWindowConfig {
  enabled: boolean;
  startMinutes: number; // 0~1439
  endMinutes: number; // 0~1439
}

/**
 * "HH:mm" 문자열을 0~1439 분으로 변환. invalid 시 null.
 */
function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * preferences.silenceWindow 를 정규화. enabled=false / invalid → null.
 */
export function parseSilenceWindow(preferences: unknown): SilenceWindowConfig | null {
  if (!preferences || typeof preferences !== "object") return null;
  const prefs = preferences as Record<string, unknown>;
  const raw = prefs.silenceWindow;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const enabled = obj.enabled === true;
  if (!enabled) return null;
  const startMinutes = parseTimeToMinutes(obj.start);
  const endMinutes = parseTimeToMinutes(obj.end);
  if (startMinutes === null || endMinutes === null) return null;
  if (startMinutes === endMinutes) return null; // 24h 차단은 의미 없음 (별도 토글 사용 권장)
  return { enabled, startMinutes, endMinutes };
}

/**
 * 현재 시각 (Asia/Seoul, KST) 이 silence window 안 여부.
 */
export function isWithinSilenceWindow(
  now: Date,
  preferences: unknown,
): boolean {
  const config = parseSilenceWindow(preferences);
  if (!config) return false;

  // Asia/Seoul (KST, UTC+9) — 운영자 전원 한국 기반. 시간대 변동 없음.
  // toLocaleString + Asia/Seoul 으로 한국 시각 hours/minutes 추출.
  let hours: number;
  let minutes: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    const minutePart = parts.find((p) => p.type === "minute")?.value ?? "0";
    hours = Number(hourPart);
    minutes = Number(minutePart);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
    if (hours === 24) hours = 0; // Intl edge case
  } catch {
    return false; // Intl 실패 — graceful (silence off, push 정상)
  }

  const nowMinutes = hours * 60 + minutes;
  const { startMinutes, endMinutes } = config;

  if (startMinutes < endMinutes) {
    // 일반 (낮 시간 예: 12:00 ~ 14:00)
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // overnight (예: 22:00 ~ 08:00) — start ~ 24:00 OR 00:00 ~ end
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

/**
 * userId 의 preferences 조회 + 현재 silence window 안 여부.
 *
 * @param userId - 발송 대상 user id.
 * @param now - 검사 시각 (default new Date()).
 * @returns true → silence 안 (push 차단). false → silence 밖 (push 통과).
 *   DB 조회 실패 → false (push 정상 전송 보장).
 */
export async function isUserInSilenceWindow(
  userId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!userId) return false;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) return false;
    return isWithinSilenceWindow(now, user.preferences);
  } catch (err) {
    console.error("[isUserInSilenceWindow] DB 조회 실패 (통과 fallback):", err);
    return false;
  }
}
