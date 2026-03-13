import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="quotes/[id]"
            options={{
              headerShown: true,
              title: "견적 상세",
              headerBackTitle: "뒤로",
            }}
          />
          <Stack.Screen
            name="purchases/register"
            options={{
              headerShown: true,
              title: "구매 내역 등록",
              headerBackTitle: "뒤로",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="inventory/[id]"
            options={{
              headerShown: true,
              title: "재고 상세",
              headerBackTitle: "뒤로",
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
