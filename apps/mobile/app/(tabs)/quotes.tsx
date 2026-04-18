import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Calendar, ChevronRight } from "lucide-react-native";
import { iconColor, spinnerColor } from "../../theme/colors";
import { useQuotes } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { SearchBar } from "../../components/SearchBar";
import { useState } from "react";
import type { Quote } from "../../types";

const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "대기" },
  { key: "SENT", label: "발송완료" },
  { key: "RESPONDED", label: "회신도착" },
  { key: "COMPLETED", label: "완료" },
  { key: "CANCELLED", label: "취소" },
  { key: "PURCHASED", label: "구매전환" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (!n) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

function QuoteCard({ item }: { item: Quote }) {
  return (
    <Pressable
      className="mx-4 mb-3 bg-white border border-slate-200 rounded-xl p-4"
      onPress={() => router.push(`/quotes/${item.id}`)}
    >
      {/* 1행: 제목 + 상태 */}
      <View className="flex-row items-start justify-between mb-2">
        <Text className="text-sm font-semibold text-slate-900 flex-1 mr-2" numberOfLines={2}>
          {item.title || "(제목 없음)"}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      {/* 2행: 메타 */}
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1">
          <Calendar size={12} color={iconColor.muted} />
          <Text className="text-xs text-slate-500">
            {formatDate(item.createdAt)}
          </Text>
        </View>
        {item.itemCount !== undefined && (
          <Text className="text-xs text-slate-500">
            {item.itemCount}개 품목
          </Text>
        )}
      </View>

      {/* 3행: 금액 + 화살표 */}
      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
        <Text className="text-base font-bold text-blue-600">
          {formatAmount(item.totalAmount)}
        </Text>
        <ChevronRight size={16} color={iconColor.faint} />
      </View>
    </Pressable>
  );
}

export default function QuotesScreen() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const { data: quotes, isLoading, refetch, isRefetching } = useQuotes(statusFilter);

  const filtered = (quotes ?? []).filter((q) =>
    search ? (q.title ?? "").toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">견적 관리</Text>
      </View>

      {/* 검색 */}
      <View className="px-4 py-3 bg-white">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="견적명 검색..."
        />
      </View>

      {/* 필터 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
        className="bg-white border-b border-slate-100"
      >
        {FILTERS.map((f) => (
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
          renderItem={({ item }) => <QuoteCard item={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <EmptyState
              title="견적이 없습니다"
              description="웹에서 제품을 검색하고 견적을 요청하세요."
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
