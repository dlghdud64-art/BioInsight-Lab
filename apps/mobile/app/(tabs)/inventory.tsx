import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { MapPin, Layers, ChevronRight, Filter } from "lucide-react-native";
import { iconColor, spinnerColor } from "../../theme/colors";
import { useInventory } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { SearchBar } from "../../components/SearchBar";
import { BottomSheet } from "../../components/BottomSheet";
import { useState } from "react";
import type { ProductInventory } from "../../types";

const STATUS_FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "NORMAL", label: "정상" },
  { key: "LOW_STOCK", label: "부족" },
  { key: "OUT_OF_STOCK", label: "소진" },
  { key: "EXPIRED", label: "만료" },
  { key: "NEEDS_INSPECTION", label: "점검 필요" },
] as const;

function InventoryCard({ item }: { item: ProductInventory }) {
  const borderColor =
    item.status === "OUT_OF_STOCK"
      ? "border-red-300"
      : item.status === "LOW_STOCK"
        ? "border-orange-300"
        : "border-slate-200";

  return (
    <Pressable
      className={`mx-4 mb-3 bg-white border ${borderColor} rounded-xl p-4`}
      onPress={() => router.push(`/inventory/${item.id}`)}
    >
      {/* 1행: 제품명 + 상태 */}
      <View className="flex-row items-start justify-between mb-1.5">
        <View className="flex-1 mr-2">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
            {item.productName || item.product?.name}
          </Text>
          {(item.brand || item.product?.brand) && (
            <Text className="text-xs text-slate-500 mt-0.5">
              {item.brand || item.product?.brand}
              {(item.catalogNumber || item.product?.catalogNumber) &&
                ` · ${item.catalogNumber || item.product?.catalogNumber}`}
            </Text>
          )}
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* 2행: 수량 + Lot 수 */}
      <View className="flex-row items-center gap-4 mt-2">
        <View>
          <Text className="text-xs text-slate-400">수량</Text>
          <Text className="text-lg font-bold text-slate-900">
            {item.quantity}{" "}
            <Text className="text-xs font-normal text-slate-500">
              {item.unit || "ea"}
            </Text>
          </Text>
        </View>
        {item.lots && item.lots.length > 0 && (
          <View className="flex-row items-center gap-1">
            <Layers size={14} color={iconColor.muted} />
            <Text className="text-xs text-slate-500">
              {item.lots.length} Lots
            </Text>
          </View>
        )}
      </View>

      {/* 3행: 위치 + 화살표 */}
      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
        <View className="flex-row items-center gap-1">
          <MapPin size={13} color={iconColor.muted} />
          <Text className="text-xs text-slate-500">
            {item.location || "위치 미지정"}
          </Text>
        </View>
        <ChevronRight size={16} color={iconColor.faint} />
      </View>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const { data: inventories, isLoading, refetch, isRefetching } = useInventory();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filtered = (inventories ?? []).filter((inv) => {
    const matchSearch = search
      ? (inv.productName || inv.product?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      : true;

    let matchStatus: boolean;
    if (statusFilter === "ALL") {
      matchStatus = true;
    } else if (statusFilter === "NEEDS_INSPECTION") {
      // 점검 미실시: lastInspectedAt이 없거나 30일 이상 경과
      const last = inv.lastInspectedAt ? new Date(inv.lastInspectedAt).getTime() : 0;
      matchStatus = !last || Date.now() - last > 30 * 24 * 60 * 60 * 1000;
    } else {
      matchStatus = inv.status === statusFilter;
    }

    return matchSearch && matchStatus;
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">재고 관리</Text>
      </View>

      {/* 검색 */}
      <View className="px-4 py-3 bg-white">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="품목명 검색..."
        />
      </View>

      {/* 상태 필터 칩 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
        className="bg-white border-b border-slate-100"
      >
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            className={`mr-2 px-3 py-1.5 rounded-full border ${
              statusFilter === f.key
                ? "bg-blue-600 border-blue-600"
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
          renderItem={({ item }) => <InventoryCard item={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <EmptyState
              title="재고 품목이 없습니다"
              description="웹에서 재고를 등록하거나 구매 내역에서 입고 처리하세요."
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
