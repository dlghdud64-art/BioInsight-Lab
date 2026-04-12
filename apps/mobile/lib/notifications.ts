import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { logEvent } from "./analytics";

/**
 * 푸시 알림 딥링크 라우팅 맵
 * 서버에서 알림 데이터에 { type, id } 형태로 전달
 */
type NotificationType = "quote" | "purchase" | "inventory" | "inspection";

interface NotificationPayload {
  type?: NotificationType;
  id?: string;
  title?: string;
  [key: string]: unknown;
}

const ROUTE_MAP: Record<NotificationType, (id: string) => string> = {
  quote: (id) => `/quotes/${id}`,
  purchase: (id) => `/purchases/${id}`,
  inventory: (id) => `/inventory/${id}`,
  inspection: (id) => `/inventory/${id}`,
};

/**
 * 알림 수신 시 포그라운드 표시 설정
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * 푸시 알림 권한 요청 + 디바이스 토큰 획득
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[Notifications] 시뮬레이터에서는 푸시를 사용할 수 없습니다.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    logEvent("push_permission_denied");
    return null;
  }

  logEvent("push_permission_granted");

  // Android 채널 설정
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563eb",
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    return tokenData.data;
  } catch (err) {
    console.error("[Notifications] 토큰 획득 실패:", err);
    return null;
  }
}

/**
 * 알림 데이터에서 딥링크 대상 경로 추출
 */
function getDeepLinkRoute(data: NotificationPayload): string | null {
  const { type, id } = data;
  if (!type || !id) return null;
  const routeFn = ROUTE_MAP[type];
  if (!routeFn) return null;
  return routeFn(id);
}

/**
 * 알림 탭 시 딥링크 라우팅 처리
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  const data = response.notification.request.content.data as NotificationPayload;

  logEvent("push_opened", {
    type: data.type ?? "unknown",
    id: data.id ?? "unknown",
  });

  const route = getDeepLinkRoute(data);
  if (route) {
    try {
      router.push(route as any);
      logEvent("push_deeplink_success", { route, type: data.type ?? "" });
    } catch (err) {
      logEvent("push_deeplink_failed", {
        route,
        error: String(err),
      });
      // 딥링크 실패 시 홈으로 이동
      router.replace("/(tabs)");
    }
  }
}

/**
 * 앱이 종료(Killed) 상태에서 알림으로 열린 경우 처리
 */
export async function handleInitialNotification(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    // 약간의 딜레이 후 라우팅 (네비게이션 준비 대기)
    setTimeout(() => {
      handleNotificationResponse(response);
    }, 500);
  }
}

/**
 * 알림 컨텍스트 뱃지 데이터 생성
 */
export function getNotificationContext(data: NotificationPayload): {
  label: string;
  color: string;
} | null {
  if (!data.type) return null;

  const labels: Record<NotificationType, string> = {
    quote: "견적 알림",
    purchase: "구매 알림",
    inventory: "재고 알림",
    inspection: "점검 알림",
  };

  const colors: Record<NotificationType, string> = {
    quote: "#f59e0b",
    purchase: "#2563eb",
    inventory: "#059669",
    inspection: "#7c3aed",
  };

  return {
    label: labels[data.type] ?? "알림",
    color: colors[data.type] ?? "#64748b",
  };
}
