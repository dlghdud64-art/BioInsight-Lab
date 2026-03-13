import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { OfflineBanner } from "../components/OfflineBanner";
import { initSentry, Sentry } from "../lib/sentry";

initSentry();

function RootLayout() {
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

        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
