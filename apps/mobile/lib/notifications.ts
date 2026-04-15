import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform, Alert } from "react-native";
import { router } from "expo-router";
import { logEvent } from "./analytics";
import { authPreflight } from "./api";

/**
 * 푸시 알림 딥링크 라우팅
 *
 * hardening 포인트:
 * 1. 인증 상태 확인 후 라우팅 (토큰 없으면 로그인으로)
 * 2. 운영 알림 타입 확장 (receiving, low_stock, expiry 등)
 * 3. 정확한 object/detail route 진입
 * 4. fallback: 대상 없으면 해당 탭으로, 인증 없으면 로그인으로
 */

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

type NotificationType =
  | "quote"
  | "quote_response"
  | "purchase"
  | "inventory"
  | "inspection"
  | "receiving"
  | "low_stock"
  | "expiry_warning"
  | "approval_pending"
  | "system";

interface NotificationPayload {
  type?: NotificationType;
  id?: string;
  /** 추가 컨텍스트 (점검 대상 inventoryId 등) */
  parentId?: string;
  title?: string;
  body?: string;
  [key: string]: unknown;
}

// ══════════════════════════════════════════════
// Route Map — 알림 타입별 정확한 진입점
// ══════════════════════════════════════════════

interface RouteTarget {
  /** 상세 화면 route (id가 있을 때) */
  detail: (id: string, parentId?: string) => string;
  /** id가 없을 때 fallback (탭 또는 목록) */
  fallback: string;
}

const ROUTE_MAP: Record<NotificationType, RouteTarget> = {
  quote: {
    detail: (id) => `/quotes/${id}`,
    fallback: "/(tabs)/quotes",
  },
  quote_response: {
    detail: (id) => `/quotes/${id}`,
    fallback: "/(tabs)/quotes",
  },
  purchase: {
    detail: (id) => `/purchases/${id}`,
    fallback: "/(tabs)/purchases",
  },
  inventory: {
    detail: (id) => `/inventory/${id}`,
    fallback: "/(tabs)/inventory",
  },
  inspection: {
    // 점검 알림 → 점검 기록 화면으로 직접 진입
    // id = inventoryId, parentId가 있으면 inspectionId
    detail: (id) => `/inventory/inspection?inventoryId=${id}`,
    fallback: "/(tabs)/inventory",
  },
  receiving: {
    detail: (id) => `/inventory/lot-receive?inventoryId=${id}`,
    fallback: "/(tabs)/inventory",
  },
  low_stock: {
    detail: (id) => `/inventory/${id}`,
    fallback: "/(tabs)/inventory",
  },
  expiry_warning: {
    detail: (id) => `/inventory/${id}`,
    fallback: "/(tabs)/inventory",
  },
  approval_pending: {
    detail: (id) => `/quotes/${id}`,
    fallback: "/(tabs)/quotes",
  },
  system: {
    detail: () => "/(tabs)",
    fallback: "/(tabs)",
  },
};

// ══════════════════════════════════════════════
// Notification handler (foreground)
// ══════════════════════════════════════════════

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ══════════════════════════════════════════════
// Permission + Token
// ══════════════════════════════════════════════

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

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563eb",
    });

    // 운영 알림 전용 채널
    await Notifications.setNotificationChannelAsync("operations", {
      name: "운영 알림",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      lightColor: "#f59e0b",
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

// ══════════════════════════════════════════════
// Deep Link Resolution
// ══════════════════════════════════════════════

/**
 * 알림 데이터에서 최적의 route를 결정합니다.
 *
 * Auth preflight:
 * 1. 토큰 유효 → 진행
 * 2. 토큰 만료 → refresh 시도
 * 3. refresh 실패 → 로그인 화면
 *
 * Route 우선순위:
 * 1. type + id → 상세 화면
 * 2. type만 → 해당 탭/목록
 * 3. 아무것도 없으면 → 홈
 */
async function resolveDeepLink(data: NotificationPayload): Promise<string> {
  // auth preflight — 토큰 검증 + 자동 refresh
  const authStatus = await authPreflight();
  if (authStatus === "login_required") {
    return "/(auth)/login";
  }

  const { type, id, parentId } = data;

  if (!type) return "/(tabs)";

  const target = ROUTE_MAP[type];
  if (!target) return "/(tabs)";

  if (id) {
    return target.detail(id, parentId);
  }

  return target.fallback;
}

/**
 * 알림 탭 시 딥링크 라우팅 처리 (hardened)
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data as NotificationPayload;

  logEvent("push_opened", {
    type: data.type ?? "unknown",
    id: data.id ?? "unknown",
  });

  resolveDeepLink(data)
    .then((route) => {
      try {
        router.push(route as any);
        logEvent("push_deeplink_success", { route, type: data.type ?? "" });
      } catch (navErr) {
        logEvent("push_deeplink_nav_error", { route, error: String(navErr) });
        // navigation 실패 시 안전한 fallback
        try {
          router.replace("/(tabs)");
        } catch {}
      }
    })
    .catch((err) => {
      logEvent("push_deeplink_resolve_error", { error: String(err) });
      try {
        router.replace("/(tabs)");
      } catch {}
    });
}

/**
 * 앱이 종료(Killed) 상태에서 알림으로 열린 경우 처리
 */
export async function handleInitialNotification(): Promise<void> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    // 네비게이션 준비 + 인증 확인 시간 확보
    setTimeout(() => {
      handleNotificationResponse(response);
    }, 800);
  }
}

// ══════════════════════════════════════════════
// Context helpers
// ══════════════════════════════════════════════

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  quote: "견적 알림",
  quote_response: "견적 응답",
  purchase: "구매 알림",
  inventory: "재고 알림",
  inspection: "점검 알림",
  receiving: "입고 알림",
  low_stock: "재고 부족",
  expiry_warning: "유효기한 임박",
  approval_pending: "승인 대기",
  system: "시스템 알림",
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  quote: "#f59e0b",
  quote_response: "#3b82f6",
  purchase: "#2563eb",
  inventory: "#059669",
  inspection: "#7c3aed",
  receiving: "#10b981",
  low_stock: "#ef4444",
  expiry_warning: "#f97316",
  approval_pending: "#6366f1",
  system: "#64748b",
};

export function getNotificationContext(data: NotificationPayload): {
  label: string;
  color: string;
} | null {
  if (!data.type) return null;
  return {
    label: NOTIFICATION_LABELS[data.type] ?? "알림",
    color: NOTIFICATION_COLORS[data.type] ?? "#64748b",
  };
}
