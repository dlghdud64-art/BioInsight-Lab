import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Calendar, Store } from "lucide-react-native";
import { usePurchases } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { SearchBar } from "../../components/SearchBar";
import { useState } from "react";
import type { PurchaseRecord } from "../../types";

function formatAmount(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function PurchaseCard({ item }: { item: PurchaseRecord }) {
  return (
    <View className="mx-4 mb-3 bg-white border border-slate-200 rounded-xl p-4">
      {/* 1행: 제품명 + 상태 */}
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-semibold text-slate-900 flex-1 mr-2" numberOfLines={2}>
          {item.productName}
        </Text>
        {item.followUpStatus && <StatusBadge status={item.followUpStatus} />}
      </View>

      {/* 2행: 메타 정보 */}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {item.vendor && (
          <View className="flex-row items-center gap-1">
            <Store size={12} color="#94a3b8" />
            <Text className="text-xs text-slate-500">{item.vendor}</Text>
          </View>
        )}
        <View className="flex-row items-center gap-1">
          <Calendar size={12} color="#94a3b8" />
          <Text className="text-xs text-slate-500">
            {formatDate(item.purchasedAt)}
          </Text>
        </View>
      </View>

      {/* 3행: 금액 + 수량 */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <Text className="text-base font-bold text-blue-600">
          {formatAmount(item.amount)}
        </Text>
        {item.quantity && (
          <Text className="text-xs text-slate-500">
            {item.quantity} {item.unit || "ea"}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function PurchasesScreen() {
  const { data: purchases, isLoading, refetch, isRefetching } = usePurchases();
  const [search, setSearch] = useState("");

  const filtered = (purchases ?? []).filter((p) =>
    search ? p.productName.toLowerCase().includes(search.toLowerCase()) : true
  );

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

      {/* 리스트 */}
      {isLoading ? (
        <ActivityIndicator color="#2563eb" className="mt-10" />
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
