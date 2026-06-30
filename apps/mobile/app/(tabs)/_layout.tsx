import { Tabs } from "expo-router";
import {
  Home,
  FileText,
  ArrowDownToLine,
  Package,
  Menu,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// §labaxis-mobile-reskin Phase 4 — 탭 IA 5탭(호영님 2026-06-30 확정):
//   대시보드 · 견적 · 입고 · 재고 · 더보기. (홈→대시보드, 입고 신규 승격,
//   구매·분석·설정 → 더보기 강등. iOS ≤5탭 권장 — 6탭 44px 깨짐 회피.)
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          borderTopColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          paddingBottom: Math.max(insets.bottom, 4),
          height: 56 + Math.max(insets.bottom, 4),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "대시보드",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: "견적",
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbound"
        options={{
          title: "입고",
          tabBarIcon: ({ color, size }) => (
            <ArrowDownToLine size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "재고",
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "더보기",
          tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
        }}
      />
      {/* 강등/숨김 — 라우트는 유지(더보기 메뉴에서 접근). */}
      <Tabs.Screen name="purchases" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}
