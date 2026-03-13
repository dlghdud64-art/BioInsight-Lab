import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, Package, User, MessageSquare } from "lucide-react-native";
import { useQuoteDetail, useUpdateQuoteStatus } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (!n) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading } = useQuoteDetail(id);
  const updateStatus = useUpdateQuoteStatus();

  const handleStatusChange = (newStatus: string, label: string) => {
    Alert.alert(`${label} 확인`, `이 견적을 '${label}' 상태로 변경하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: label,
        onPress: () => {
          updateStatus.mutate(
            { id, status: newStatus },
            {
              onSuccess: () => Alert.alert("완료", `견적이 '${label}' 상태로 변경되었습니다.`),
              onError: () => Alert.alert("오류", "상태 변경에 실패했습니다."),
            }
          );
        },
      },
    ]);
  };

  if (isLoading || !quote) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const canApprove = ["PENDING", "ON_HOLD"].includes(quote.status);
  const canHold = ["PENDING", "IN_PROGRESS"].includes(quote.status);
  const canCancel = !["COMPLETED", "CANCELLED"].includes(quote.status);

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 기본 정보 카드 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <View className="flex-row items-start justify-between mb-3">
            <Text className="text-base font-bold text-slate-900 flex-1 mr-2">
              {quote.title}
            </Text>
            <StatusBadge status={quote.status} />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Calendar size={14} color="#94a3b8" />
              <Text className="text-xs text-slate-500">
                생성: {formatDate(quote.createdAt)}
              </Text>
            </View>
            {quote.requesterName && (
              <View className="flex-row items-center gap-2">
                <User size={14} color="#94a3b8" />
                <Text className="text-xs text-slate-500">
                  요청자: {quote.requesterName}
                </Text>
              </View>
            )}
            {quote.totalAmount && (
              <View className="flex-row items-center gap-2">
                <Package size={14} color="#94a3b8" />
                <Text className="text-sm font-bold text-blue-600">
                  총액: {formatAmount(quote.totalAmount)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 품목 리스트 */}
        <View className="mx-4 mt-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">
            품목 ({quote.items?.length ?? 0}개)
          </Text>
          {(quote.items ?? []).map((item, idx) => (
            <View
              key={item.id || idx}
              className="bg-white rounded-xl border border-slate-200 p-3.5 mb-2"
            >
              <Text className="text-sm font-medium text-slate-800" numberOfLines={2}>
                {item.productName}
              </Text>
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row gap-3">
                  {item.brand && (
                    <Text className="text-xs text-slate-500">{item.brand}</Text>
                  )}
                  <Text className="text-xs text-slate-500">
                    {item.quantity} {item.unit || "ea"}
                  </Text>
                </View>
                {item.totalPrice && (
                  <Text className="text-sm font-semibold text-slate-700">
                    {formatAmount(item.totalPrice)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* 메모 */}
        {quote.notes && (
          <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <MessageSquare size={14} color="#94a3b8" />
              <Text className="text-sm font-bold text-slate-900">메모</Text>
            </View>
            <Text className="text-sm text-slate-600">{quote.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 바 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8 flex-row gap-2">
        {canApprove && (
          <Pressable
            className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
            onPress={() => handleStatusChange("IN_PROGRESS", "승인")}
          >
            <Text className="text-sm font-semibold text-white">승인</Text>
          </Pressable>
        )}
        {canHold && (
          <Pressable
            className="flex-1 bg-purple-100 rounded-xl py-3 items-center"
            onPress={() => handleStatusChange("ON_HOLD", "보류")}
          >
            <Text className="text-sm font-semibold text-purple-700">보류</Text>
          </Pressable>
        )}
        {canCancel && (
          <Pressable
            className="flex-1 bg-red-100 rounded-xl py-3 items-center"
            onPress={() => handleStatusChange("CANCELLED", "반려")}
          >
            <Text className="text-sm font-semibold text-red-700">반려</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
