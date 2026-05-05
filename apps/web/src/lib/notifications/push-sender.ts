/**
 * #mobile-push-notification Phase 1 server — Expo Push 발송 helper.
 *
 * canonical truth = Device 모델 (pushToken 저장).
 * Expo Push API: https://exp.host/--/api/v2/push/send (POST, JSON)
 *
 * Lock:
 *   - userId 기반 device 조회 → 모든 token 으로 broadcast (multi-device 지원)
 *   - try/catch graceful (push fail 시 mutation 영향 0 — best effort)
 *   - 빈 token list 시 silent skip (사용자가 mobile 앱 미설치 / 권한 거부)
 *
 * 향후 (Phase 2):
 *   - 결재 mutation route 에 sendPushNotification 호출 추가
 *
 * 향후 (Phase 3 — 호영님 host):
 *   - Apple Dev cert + APN key (Expo 가 자동 처리, EAS build 필요)
 *   - FCM Server key (Android push, EAS native config)
 *   - EAS native build (production push token)
 */

import { db } from "@/lib/db";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  /** notification 제목 (한국어) */
  title: string;
  /** notification 본문 */
  body: string;
  /** deep link 라우팅용 — mobile 의 handleNotificationResponse 가 사용 */
  data?: Record<string, unknown>;
  /** 사운드 재생 여부 — default true */
  sound?: "default" | null;
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  skipped: boolean;
}

/**
 * userId 기반 모든 device push token 으로 발송.
 * 빈 token list → skipped: true (사용자 mobile 미등록).
 * Expo Push API 실패 시 throw 0 — best effort, return failureCount.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<SendPushResult> {
  try {
    const devices = await db.device.findMany({
      where: { userId },
      select: { pushToken: true },
    });

    if (devices.length === 0) {
      return { successCount: 0, failureCount: 0, skipped: true };
    }

    const messages = devices.map((d) => ({
      to: d.pushToken,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: payload.sound === null ? null : "default",
    }));

    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    if (!res.ok) {
      console.error(
        "[sendPushNotification] Expo Push API non-OK:",
        res.status,
        await res.text().catch(() => ""),
      );
      return {
        successCount: 0,
        failureCount: devices.length,
        skipped: false,
      };
    }

    const json = (await res.json()) as { data?: Array<{ status?: string }> };
    const data = json.data ?? [];
    const successCount = data.filter((d) => d.status === "ok").length;
    const failureCount = data.length - successCount;

    return { successCount, failureCount, skipped: false };
  } catch (err) {
    console.error("[sendPushNotification] error:", err);
    return { successCount: 0, failureCount: 1, skipped: false };
  }
}
