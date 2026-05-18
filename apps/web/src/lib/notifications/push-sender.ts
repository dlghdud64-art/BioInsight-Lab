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
 * §11.250-pref-push — optional eventType 3rd param 추가. eventType 제공 시
 *   isUserPreferenceAllowed (preference-filter) 으로 사용자 카테고리 토글 확인.
 *   명시 false → skipped:true 즉시 return (Device.findMany 호출 0 — DB load 절감).
 *   eventType 미제공 시 기존 동작 보존 (backward compat).
 *   §11.250-pref (in-app filter) + §11.250-pref-ui (settings 토글) 와 1:1 정합.
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
import { isUserPreferenceAllowed } from "./preference-filter";
// §11.250-pref-silence — 방해 금지 시간 (KST 22:00~08:00 등) push 차단.
//   in-app NotificationAction 은 영향 0 (silence 는 push 전용).
import { isUserInSilenceWindow } from "./silence-window";

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
  eventType?: string,
): Promise<SendPushResult> {
  try {
    // §11.250-pref-push — eventType 제공 시 user preference 확인. 명시 false 면 즉시 skip.
    //   eventType 미제공 시 backward compat (기존 caller 영향 0).
    if (eventType) {
      const allowed = await isUserPreferenceAllowed(userId, eventType);
      if (!allowed) {
        return { successCount: 0, failureCount: 0, skipped: true };
      }
    }

    // §11.250-pref-silence — 방해 금지 시간 (KST) push 차단. preference-push
    //   다음 layer 으로 적용 — 카테고리 통과해도 silence window 안이면 push skip.
    //   in-app NotificationAction 은 dispatcher 가 이미 생성 (silence 영향 0).
    //   DB fail / silence 미설정 시 false (push 정상 전송).
    const inSilence = await isUserInSilenceWindow(userId);
    if (inSilence) {
      return { successCount: 0, failureCount: 0, skipped: true };
    }

    const devices = await db.device.findMany({
      where: { userId },
      select: { pushToken: true },
    });

    if (devices.length === 0) {
      return { successCount: 0, failureCount: 0, skipped: true };
    }

    // §11.237 — devices implicit any narrow.
    const messages = devices.map((d: typeof devices[number]) => ({
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
