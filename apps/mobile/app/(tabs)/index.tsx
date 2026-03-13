import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ShoppingCart,
  Package,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  ChevronRight,
  Calendar,
  QrCode,
  ClipboardCheck,
} from "lucide-react-native";
import { useDashboardSummary, usePurchases } from "../../hooks/useApi";

function formatAmount(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { data: summary, isLoading, refetch, isRefetching } = useDashboardSummary();
  const { data: purchases } = usePurchases();

  const recentPurchases = (purchases ?? []).slice(0, 3);

  // 실제 데이터가 있는 작업만 표시
  const tasks = [
    {
      icon: FileText,
      label: "승인 대기 견적",
      count: summary?.pendingQuotes ?? 0,
      color: "#f59e0b",
      bgColor: "bg-amber-50",
      onPress: () => router.push("/(tabs)/quotes"),
    },
    {
      icon: AlertTriangle,
      label: "재고 부족 알림",
      count: summary?.lowStockItems ?? 0,
      color: "#ef4444",
      bgColor: "bg-red-50",
      onPress: () => router.push("/(tabs)/inventory"),
    },
    {
      icon: ClipboardCheck,
      label: "점검 필요",
      count: summary?.pendingInspections ?? 0,
      color: "#7c3aed",
      bgColor: "bg-purple-50",
      onPress: () => router.push("/(tabs)/inventory"),
    },
  ].filter((t) => t.count > 0);

  const shortcuts = [
    {
      icon: FileText,
      label: "견적 확인",
      color: "#f59e0b",
      onPress: () => router.push("/(tabs)/quotes"),
    },
    {
      icon: ShoppingCart,
      label: "구매 등록",
      color: "#2563eb",
      onPress: () => router.push("/purchases/register"),
    },
    {
      icon: ArrowDownToLine,
      label: "입고 처리",
      color: "#059669",
      onPress: () => router.push("/(tabs)/inventory"),
    },
    {
      icon: ArrowUpFromLine,
      label: "출고 처리",
      color: "#8b5cf6",
      onPress: () => router.push("/(tabs)/inventory"),
    },
    {
      icon: QrCode,
      label: "QR 스캔",
      color: "#0ea5e9",
      onPress: () => router.push("/scan"),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* 헤더 */}
        <View className="px-5 pt-3 pb-4">
          <Text className="text-xl font-bold text-slate-900">
            BioInsight Lab
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            검색·견적·구매·재고 운영 플랫폼
          </Text>
        </View>

        {/* 오늘 처리할 일 — 실제 데이터가 있는 항목만 */}
        {isLoading ? (
          <ActivityIndicator color="#2563eb" className="py-8" />
        ) : tasks.length > 0 ? (
          <View className="px-5 mb-5">
            <Text className="text-base font-bold text-slate-900 mb-3">
              오늘 처리할 일
            </Text>
            <View className="gap-2">
              {tasks.map((task) => (
                <Pressable
                  key={task.label}
                  className={`flex-row items-center justify-between p-3.5 rounded-xl ${task.bgColor}`}
                  onPress={task.onPress}
                >
                  <View className="flex-row items-center gap-3">
                    <task.icon size={20} color={task.color} />
                    <Text className="text-sm font-medium text-slate-700">
                      {task.label}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="bg-white rounded-full px-2 py-0.5 min-w-[28px] items-center">
                      <Text
                        className="text-xs font-bold"
                        style={{ color: task.color }}
                      >
                        {task.count}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94a3b8" />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* 바로가기 */}
        <View className="px-5 mb-5">
          <Text className="text-base font-bold text-slate-900 mb-3">
            바로가기
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {shortcuts.map((sc) => (
              <Pressable
                key={sc.label}
                className="w-[47%] bg-white border border-slate-200 rounded-xl p-4 items-center gap-2.5"
                onPress={sc.onPress}
              >
                <View
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${sc.color}15` }}
                >
                  <sc.icon size={22} color={sc.color} />
                </View>
                <Text className="text-xs font-semibold text-slate-700">
                  {sc.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 최근 구매 내역 */}
        {recentPurchases.length > 0 && (
          <View className="px-5 mb-8">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-slate-900">
                최근 구매 내역
              </Text>
              <Pressable onPress={() => router.push("/(tabs)/purchases")}>
                <Text className="text-xs text-blue-600 font-medium">전체 보기</Text>
              </Pressable>
            </View>
            <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {recentPurchases.map((p, idx) => (
                <Pressable
                  key={p.id}
                  className={`flex-row items-center justify-between p-3.5 ${
                    idx < recentPurchases.length - 1 ? "border-b border-slate-100" : ""
                  }`}
                  onPress={() => router.push(`/purchases/${p.id}` as any)}
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-medium text-slate-800" numberOfLines={1}>
                      {p.productName}
                    </Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Calendar size={10} color="#94a3b8" />
                      <Text className="text-xs text-slate-400">
                        {formatDate(p.purchasedAt)}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm font-bold text-blue-600">
                    {formatAmount(p.amount)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
