/**
 * §11.250-pref #notification-preference-filter — role-aware notification preference (backend infra).
 *
 * 사용자가 카테고리별 알림 수신 토글. server-side preference filter — dispatcher
 * 안 recipients 가 false 인 사용자 제외.
 *
 * Strategy:
 *   - User.preferences.notificationToggles[category] 조회.
 *   - 명시적 false → 제외. 그 외 (undefined/null/missing/true) → 통과 (default true).
 *   - email-only recipient (userId null) → 그대로 통과 (vendor email 등 외부).
 *   - DB fail (network / Prisma 미생성 등) → 전체 recipients 통과 (graceful fallback).
 *
 * canonical truth lock:
 *   - User.preferences Json field reuse (schema 0, §11.230c (a) cluster 와 일관).
 *   - eventTypeToCategory 7 카테고리 매핑 reuse (event-category-map.ts).
 *   - default true 보존 → 기존 사용자 영향 0 (회귀 0).
 *
 * UI:
 *   - settings/notifications 토글 UI 는 별도 cluster (§11.250-pref-ui).
 *   - 본 helper 는 backend infra 만 제공.
 */

import { db } from "@/lib/db";
import { eventTypeToCategory, type NotificationCategory } from "./event-category-map";

export interface PreferenceRecipient {
  userId?: string | null;
  email?: string | null;
}

/**
 * recipients 를 user preference 기준으로 filter.
 *
 * @param recipients - dispatchNotificationEvent recipients array
 * @param eventType - NotificationEvent.eventType (category 매핑용)
 * @returns filtered recipients (preference false 제외, email-only 통과)
 */
export async function filterRecipientsByPreference<T extends PreferenceRecipient>(
  recipients: readonly T[],
  eventType: string,
): Promise<T[]> {
  if (!recipients || recipients.length === 0) return [];

  const category: NotificationCategory = eventTypeToCategory(eventType);

  // userId 있는 recipient 만 preference 확인. email-only 는 자동 통과.
  const userIds: string[] = [];
  for (const r of recipients) {
    if (r.userId) userIds.push(r.userId);
  }

  // userId 없으면 (모두 email-only) 그대로 통과.
  if (userIds.length === 0) return [...recipients];

  // graceful fallback — DB fail 시 전체 통과 (default true).
  let blockedUserIds = new Set<string>();
  try {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, preferences: true },
    });

    for (const u of users as Array<{ id: string; preferences: unknown }>) {
      const prefs = (u.preferences ?? {}) as Record<string, unknown>;
      const toggles = (prefs.notificationToggles ?? {}) as Record<string, unknown>;
      const toggleValue = toggles[category];
      // 명시 false 만 제외 (default true 보존).
      if (toggleValue === false) {
        blockedUserIds.add(u.id);
      }
    }
  } catch (err) {
    // graceful — DB 조회 실패 시 전체 통과 (보존 동작).
    console.error("[preference-filter] DB 조회 실패 (전체 통과 fallback):", err);
    return [...recipients];
  }

  // userId 있고 blockedUserIds 안 포함된 recipient 만 통과. email-only 는 통과.
  return recipients.filter((r) => {
    if (!r.userId) return true; // email-only 통과
    return !blockedUserIds.has(r.userId);
  });
}

/**
 * §11.250-pref-push #isUserPreferenceAllowed — single-userId 변형.
 *
 * 호영님 spec: sendPushNotification (push-sender.ts) 안 preference filter 적용
 *   위해 single-userId 형태 helper. filterRecipientsByPreference 와 동일 로직
 *   (default true + 명시 false 만 차단 + graceful DB fail).
 *
 * @param userId - push 발송 대상 사용자 id.
 * @param eventType - NotificationEvent.eventType (category 매핑용).
 * @returns true → 발송 허용, false → 명시적 차단. DB fail 시 true (보존 동작).
 */
export async function isUserPreferenceAllowed(
  userId: string,
  eventType: string,
): Promise<boolean> {
  if (!userId) return true; // 안전망 — caller 가 빈 userId 전달 시 통과 (push-sender 가 skip).

  const category: NotificationCategory = eventTypeToCategory(eventType);

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) return true; // user 없음 → 보존 동작 (push-sender 가 device 0 으로 skip).

    const prefs = (user.preferences ?? {}) as Record<string, unknown>;
    const toggles = (prefs.notificationToggles ?? {}) as Record<string, unknown>;
    const toggleValue = toggles[category];

    // 명시 false 만 차단. 그 외 (undefined/null/missing/true) → 통과.
    if (toggleValue === false) return false;
    return true;
  } catch (err) {
    // graceful — DB 조회 실패 시 통과 (push 정상 전송 보장).
    console.error("[isUserPreferenceAllowed] DB 조회 실패 (통과 fallback):", err);
    return true;
  }
}
