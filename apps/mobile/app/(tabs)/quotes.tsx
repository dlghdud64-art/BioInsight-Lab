import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Calendar, ChevronRight } from "lucide-react-native";
import { useQuotes } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import type { Quote } from "../../types";

const FILTERS = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "대기" },
  { key: "IN_PROGRESS", label: "진행" },
  { key: "COMPLETED", label: "완료" },
  { key: "ON_HOLD", label: "보류" },
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
          {item.title}
        </Text>
        <StatusBadge status={item.status} />
      </View>

      {/* 2행: 메타 */}
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1">
          <Calendar size={12} color="#94a3b8" />
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
        <ChevronRight size={16} color="#cbd5e1" />
      </View>
    </Pressable>
  );
}

export default function QuotesScreen() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { data: quotes, isLoading, refetch, isRefetching } = useQuotes(statusFilter);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">견적 관리</Text>
      </View>

      {/* 필터 */}
      <View className="px-4 py-2.5 bg-white flex-row gap-2">
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            className={`px-3 py-1.5 rounded-full ${
              statusFilter === f.key
                ? "bg-blue-600"
                : "bg-slate-100"
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
      </View>

      {/* 리스트 */}
      {isLoading ? (
        <ActivityIndicator color="#2563eb" className="mt-10" />
      ) : (
        <FlatList
          data={quotes ?? []}
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
