import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Calendar, Store, ChevronRight } from "lucide-react-native";
import { iconColor, spinnerColor } from "../../theme/colors";
import { usePurchases } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { SearchBar } from "../../components/SearchBar";
import { useState } from "react";
import type { PurchaseRecord } from "../../types";

const PERIOD_FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "1W", label: "1주", days: 7 },
  { key: "1M", label: "1달", days: 30 },
  { key: "3M", label: "3달", days: 90 },
] as const;

const STATUS_FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "NOT_REFLECTED", label: "미반영" },
  { key: "REFLECTED", label: "입고완료" },
] as const;

function formatAmount(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function PurchaseCard({ item }: { item: PurchaseRecord }) {
  return (
    <Pressable
      className="mx-4 mb-3 bg-white border border-slate-200 rounded-xl p-4"
      onPress={() => router.push(`/purchases/${item.id}` as any)}
    >
      {/* 1행: 제품명 + 상태 */}
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-semibold text-slate-900 flex-1 mr-2" numberOfLines={2}>
          {item.productName || "(제품명 없음)"}
        </Text>
        {item.followUpStatus && <StatusBadge status={item.followUpStatus} />}
      </View>

      {/* 2행: 메타 정보 */}
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        {item.vendor && (
          <View className="flex-row items-center gap-1">
            <Store size={12} color={iconColor.muted} />
            <Text className="text-xs text-slate-500">{item.vendor}</Text>
          </View>
        )}
        <View className="flex-row items-center gap-1">
          <Calendar size={12} color={iconColor.muted} />
          <Text className="text-xs text-slate-500">
            {formatDate(item.purchasedAt)}
          </Text>
        </View>
      </View>

      {/* 3행: 금액 + 수량 + chevron */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <Text className="text-base font-bold text-blue-600">
          {formatAmount(item.amount)}
        </Text>
        <View className="flex-row items-center gap-2">
          {item.quantity && (
            <Text className="text-xs text-slate-500">
              {item.quantity} {item.unit || "ea"}
            </Text>
          )}
          <ChevronRight size={14} color={iconColor.muted} />
        </View>
      </View>
    </Pressable>
  );
}

export default function PurchasesScreen() {
  const { data: purchases, isLoading, refetch, isRefetching } = usePurchases();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = (purchases ?? []).filter((p) => {
    const matchSearch = search
      ? (p.productName ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    if (!matchSearch) return false;

    // 기간 필터
    if (period !== "ALL") {
      const filter = PERIOD_FILTERS.find((f) => f.key === period);
      if (filter && "days" in filter) {
        const cutoff = Date.now() - filter.days * 24 * 60 * 60 * 1000;
        if (new Date(p.purchasedAt).getTime() < cutoff) return false;
      }
    }

    // 반영 상태 필터
    if (statusFilter === "REFLECTED") {
      return p.followUpStatus === "inventory_reflected";
    }
    if (statusFilter === "NOT_REFLECTED") {
      return !p.followUpStatus || p.followUpStatus !== "inventory_reflected";
    }

    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">구매 내역</Text>
        <Pressable
          className="flex-row items-center gap-1 bg-blue-600 rounded-lg px-3 py-2"
          onPress={() => router.push("/purchases/register")}
        >
          <Plus size={16} color="white" />
          <Text className="text-xs font-semibold text-white">등록</Text>
        </Pressable>
      </View>

      {/* 검색 */}
      <View className="px-4 py-3 bg-white">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="제품명 검색..."
        />
      </View>

      {/* 기간 필터 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        className="bg-white border-b border-slate-100"
      >
        {PERIOD_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            className={`mr-2 px-3 py-1.5 rounded-full border ${
              period === f.key
                ? "bg-blue-600 border-blue-600"
                : "bg-white border-slate-200"
            }`}
            onPress={() => setPeriod(f.key)}
          >
            <Text
              className={`text-xs font-medium ${
                period === f.key ? "text-white" : "text-slate-600"
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 반영 상태 필터 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
        className="bg-white border-b border-slate-100"
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            className={`mr-2 px-3 py-1.5 rounded-full border ${
              statusFilter === f.key
                ? "bg-emerald-600 border-emerald-600"
                : "bg-white border-slate-200"
            }`}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text
              className={`text-xs font-medium ${
                statusFilter === f.key ? "text-white" : "text-slate-600"
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 리스트 */}
      {isLoading ? (
        <ActivityIndicator color={spinnerColor} className="mt-10" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PurchaseCard item={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <EmptyState
              title="구매 내역이 없습니다"
              description="상단 '등록' 버튼으로 구매 내역을 추가하세요."
            />
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      )}
    </SafeAreaView>
  );
}
