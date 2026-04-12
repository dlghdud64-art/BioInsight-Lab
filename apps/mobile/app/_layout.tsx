import "../global.css";
import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { OfflineBanner } from "../components/OfflineBanner";
import { initSentry, Sentry } from "../lib/sentry";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotifications,
  handleNotificationResponse,
  handleInitialNotification,
} from "../lib/notifications";
import { apiClient } from "../lib/api";

initSentry();

function RootLayout() {
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // 푸시 알림 초기화
    registerForPushNotifications().then((token) => {
      if (token) {
        // 서버에 디바이스 토큰 등록 (실패해도 무시)
        apiClient
          .post("/api/devices/register", { pushToken: token })
          .catch(() => {});
      }
    });

    // 앱이 Killed 상태에서 알림으로 열린 경우 처리
    handleInitialNotification();

    // 포그라운드/백그라운드에서 알림 탭 처리
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />

          {/* ─── 견적 ─── */}
          <Stack.Screen
            name="quotes/[id]"
            options={{ headerShown: true, title: "견적 상세", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="quotes/status-change"
            options={{ headerShown: true, title: "상태 변경", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="quotes/memo"
            options={{ headerShown: true, title: "견적 메모", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="quotes/order-confirm"
            options={{ headerShown: true, title: "주문 전환", headerBackTitle: "뒤로" }}
          />

          {/* ─── 구매 ─── */}
          <Stack.Screen
            name="purchases/register"
            options={{ headerShown: true, title: "구매 내역 등록", headerBackTitle: "뒤로", presentation: "modal" }}
          />
          <Stack.Screen
            name="purchases/[id]"
            options={{ headerShown: true, title: "구매 상세", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="purchases/complete"
            options={{ headerShown: true, title: "등록 완료", headerBackTitle: "뒤로" }}
          />

          {/* ─── 재고 ─── */}
          <Stack.Screen
            name="inventory/[id]"
            options={{ headerShown: true, title: "재고 상세", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="inventory/lot-receive"
            options={{ headerShown: true, title: "입고 등록", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="inventory/lot-dispatch"
            options={{ headerShown: true, title: "출고 등록", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="inventory/lot-location"
            options={{ headerShown: true, title: "위치 지정", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="inventory/lot-label"
            options={{ headerShown: true, title: "라벨 인쇄", headerBackTitle: "뒤로" }}
          />
          <Stack.Screen
            name="inventory/inspection"
            options={{ headerShown: true, title: "점검 기록", headerBackTitle: "뒤로" }}
          />

          {/* ─── 스캔 ─── */}
          <Stack.Screen
            name="scan"
            options={{ headerShown: false, presentation: "fullScreenModal" }}
          />

        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
