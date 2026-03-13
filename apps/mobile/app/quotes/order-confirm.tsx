import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ShoppingCart, Package, Calendar, User } from "lucide-react-native";
import { useQuoteDetail, useConvertQuoteToOrder } from "../../hooks/useApi";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (!n) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function QuoteOrderConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading } = useQuoteDetail(id);
  const convertToOrder = useConvertQuoteToOrder();

  const handleConvert = () => {
    Alert.alert(
      "주문 전환",
      "이 견적을 구매 주문으로 전환하시겠습니까?\n전환 후에는 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "전환",
          style: "destructive",
          onPress: () => {
            convertToOrder.mutate(
              { id },
              {
                onSuccess: () => {
                  Alert.alert("완료", "구매 주문으로 전환되었습니다.", [
                    { text: "확인", onPress: () => router.dismissAll() },
                  ]);
                },
                onError: () => Alert.alert("오류", "주문 전환에 실패했습니다."),
              }
            );
          },
        },
      ]
    );
  };

  if (isLoading || !quote) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const firstItem = quote.items?.[0];

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* 확인 헤더 */}
        <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-center gap-2 mb-1">
            <ShoppingCart size={18} color="#059669" />
            <Text className="text-base font-bold text-emerald-700">주문 전환 확인</Text>
          </View>
          <Text className="text-xs text-emerald-600">
            아래 견적을 구매 주문으로 전환합니다.
          </Text>
        </View>

        {/* 견적 요약 */}
        <View className="bg-white border border-slate-200 rounded-xl p-4 gap-3">
          <View>
            <Text className="text-xs text-slate-400">견적 제목</Text>
            <Text className="text-sm font-semibold text-slate-900">{quote.title}</Text>
          </View>

          {firstItem && (
            <View className="flex-row items-center gap-2">
              <Package size={14} color="#94a3b8" />
              <View>
                <Text className="text-xs text-slate-400">대표 품목</Text>
                <Text className="text-sm text-slate-700">
                  {firstItem.productName}
                  {(quote.items?.length ?? 0) > 1 && ` 외 ${(quote.items?.length ?? 0) - 1}건`}
                </Text>
              </View>
            </View>
          )}

          {quote.totalAmount != null && (
            <View>
              <Text className="text-xs text-slate-400">총 금액</Text>
              <Text className="text-lg font-bold text-blue-600">{formatAmount(quote.totalAmount)}</Text>
            </View>
          )}

          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-1.5">
              <Calendar size={12} color="#94a3b8" />
              <Text className="text-xs text-slate-500">{formatDate(quote.createdAt)}</Text>
            </View>
            {quote.requesterName && (
              <View className="flex-row items-center gap-1.5">
                <User size={12} color="#94a3b8" />
                <Text className="text-xs text-slate-500">{quote.requesterName}</Text>
              </View>
            )}
          </View>

          <View>
            <Text className="text-xs text-slate-400">품목 수</Text>
            <Text className="text-sm text-slate-700">{quote.items?.length ?? 0}개</Text>
          </View>
        </View>
      </ScrollView>

      {/* 하단 액션 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-5 py-3 pb-8 flex-row gap-3">
        <Pressable
          className="flex-1 border border-slate-200 rounded-xl py-3.5 items-center"
          onPress={() => router.back()}
          disabled={convertToOrder.isPending}
        >
          <Text className="text-sm font-semibold text-slate-600">취소</Text>
        </Pressable>
        <Pressable
          className="flex-1 bg-emerald-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
          onPress={handleConvert}
          disabled={convertToOrder.isPending}
        >
          {convertToOrder.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <ShoppingCart size={16} color="white" />
              <Text className="text-sm font-semibold text-white">주문 전환</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
