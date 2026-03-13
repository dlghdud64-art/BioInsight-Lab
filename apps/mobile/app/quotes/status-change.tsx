import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import { useQuoteDetail, useUpdateQuoteStatus } from "../../hooks/useApi";

const STATUSES = [
  { key: "PENDING", label: "신규 요청", color: "#f59e0b" },
  { key: "IN_PROGRESS", label: "검토 중", color: "#2563eb" },
  { key: "VENDOR_INQUIRY", label: "공급사 문의중", color: "#8b5cf6" },
  { key: "WAITING_REPLY", label: "고객 회신 대기", color: "#06b6d4" },
  { key: "COMPLETED", label: "견적 발송 완료", color: "#059669" },
  { key: "PURCHASED", label: "주문 전환", color: "#16a34a" },
  { key: "ON_HOLD", label: "보류", color: "#64748b" },
  { key: "CANCELLED", label: "취소", color: "#ef4444" },
];

export default function QuoteStatusChangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading, isError, refetch } = useQuoteDetail(id);
  const updateStatus = useUpdateQuoteStatus();

  const handleSelect = (statusKey: string, label: string) => {
    if (statusKey === quote?.status) return;

    Alert.alert("상태 변경", `'${label}'(으)로 변경하시겠습니까?`, [
      { text: "취소", style: "cancel" },
      {
        text: "변경",
        onPress: () => {
          updateStatus.mutate(
            { id, status: statusKey },
            {
              onSuccess: () => {
                Alert.alert("완료", `'${label}' 상태로 변경되었습니다.`, [
                  { text: "확인", onPress: () => router.back() },
                ]);
              },
              onError: () => Alert.alert("오류", "상태 변경에 실패했습니다."),
            }
          );
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError || !quote) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-bold text-slate-900 mb-1">불러오기 실패</Text>
        <Text className="text-sm text-slate-500 text-center mb-4">견적 정보를 가져올 수 없습니다.</Text>
        <Pressable className="bg-blue-600 rounded-xl px-6 py-3" onPress={() => refetch()}>
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text className="text-base font-bold text-slate-900 mb-1">{quote.title}</Text>
      <Text className="text-xs text-slate-400 mb-6">변경할 상태를 선택하세요</Text>

      <View className="gap-2">
        {STATUSES.map((s) => {
          const isCurrent = s.key === quote.status;
          return (
            <Pressable
              key={s.key}
              className={`flex-row items-center justify-between p-4 rounded-xl border ${
                isCurrent ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
              }`}
              onPress={() => handleSelect(s.key, s.label)}
              disabled={updateStatus.isPending}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <Text className={`text-sm font-medium ${isCurrent ? "text-blue-700" : "text-slate-700"}`}>
                  {s.label}
                </Text>
              </View>
              {isCurrent && <CheckCircle size={18} color="#2563eb" />}
            </Pressable>
          );
        })}
      </View>

      {updateStatus.isPending && (
        <View className="items-center mt-6">
          <ActivityIndicator color="#2563eb" />
          <Text className="text-xs text-slate-400 mt-2">변경 중...</Text>
        </View>
      )}
    </ScrollView>
  );
}
