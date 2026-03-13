import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Bell,
  Search,
  ShoppingCart,
  Package,
  FileText,
  QrCode,
  AlertTriangle,
  Clock,
  ChevronRight,
} from "lucide-react-native";
import { useDashboardSummary } from "../../hooks/useApi";

export default function HomeScreen() {
  const { data: summary, isLoading, refetch, isRefetching } = useDashboardSummary();

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
      icon: Package,
      label: "입고 예정",
      count: 0,
      color: "#3b82f6",
      bgColor: "bg-blue-50",
      onPress: () => router.push("/(tabs)/purchases"),
    },
    {
      icon: Clock,
      label: "점검 필요",
      count: 0,
      color: "#8b5cf6",
      bgColor: "bg-purple-50",
      onPress: () => router.push("/(tabs)/more"),
    },
  ];

  const shortcuts = [
    {
      icon: ShoppingCart,
      label: "구매 등록",
      color: "#2563eb",
      onPress: () => router.push("/purchases/register"),
    },
    {
      icon: Package,
      label: "입고 처리",
      color: "#059669",
      onPress: () => router.push("/(tabs)/inventory"),
    },
    {
      icon: FileText,
      label: "견적 확인",
      color: "#f59e0b",
      onPress: () => router.push("/(tabs)/quotes"),
    },
    {
      icon: QrCode,
      label: "재고 스캔",
      color: "#8b5cf6",
      onPress: () => router.push("/(tabs)/inventory"),
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
        <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
          <View>
            <Text className="text-xl font-bold text-slate-900">
              BioInsight Lab
            </Text>
            <Text className="text-xs text-slate-500 mt-0.5">
              검색·견적·구매·재고 운영 플랫폼
            </Text>
          </View>
          <Pressable className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center">
            <Bell size={20} color="#64748b" />
          </Pressable>
        </View>

        {/* 검색바 */}
        <Pressable
          className="mx-5 mb-5 flex-row items-center bg-slate-100 rounded-xl px-4 h-11"
          onPress={() => router.push("/(tabs)/search" as any)}
        >
          <Search size={18} color="#94a3b8" />
          <Text className="ml-2 text-sm text-slate-400">제품 검색...</Text>
        </Pressable>

        {/* 오늘 처리할 일 */}
        <View className="px-5 mb-5">
          <Text className="text-base font-bold text-slate-900 mb-3">
            오늘 처리할 일
          </Text>
          {isLoading ? (
            <ActivityIndicator color="#2563eb" className="py-8" />
          ) : (
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
                    {task.count > 0 && (
                      <View className="bg-white rounded-full px-2 py-0.5 min-w-[28px] items-center">
                        <Text
                          className="text-xs font-bold"
                          style={{ color: task.color }}
                        >
                          {task.count}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color="#94a3b8" />
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 바로가기 */}
        <View className="px-5 mb-8">
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
      </ScrollView>
    </SafeAreaView>
  );
}
