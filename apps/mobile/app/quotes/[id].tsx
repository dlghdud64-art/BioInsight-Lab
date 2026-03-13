import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Calendar, Package, User, MessageSquare, ShoppingCart, Truck } from "lucide-react-native";
import {
  useQuoteDetail,
  useUpdateQuoteStatus,
  useUpdateQuoteMemo,
  useConvertQuoteToOrder,
} from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { useState, useEffect } from "react";

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
  const updateMemo = useUpdateQuoteMemo();
  const convertToOrder = useConvertQuoteToOrder();

  const [memo, setMemo] = useState("");
  const [memoEdited, setMemoEdited] = useState(false);

  useEffect(() => {
    if (quote?.description) {
      setMemo(quote.description);
    }
  }, [quote?.description]);

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

  const handleSaveMemo = () => {
    updateMemo.mutate(
      { id, description: memo },
      {
        onSuccess: () => {
          setMemoEdited(false);
          Alert.alert("완료", "메모가 저장되었습니다.");
        },
        onError: () => Alert.alert("오류", "메모 저장에 실패했습니다."),
      }
    );
  };

  const handleConvertToOrder = () => {
    Alert.alert(
      "구매 전환",
      "이 견적을 구매 주문으로 전환하시겠습니까?\n전환 후에는 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "구매 전환",
          style: "destructive",
          onPress: () => {
            convertToOrder.mutate(
              { id },
              {
                onSuccess: () => Alert.alert("완료", "구매 주문으로 전환되었습니다."),
                onError: () => Alert.alert("오류", "구매 전환에 실패했습니다."),
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

  const canApprove = ["PENDING", "ON_HOLD"].includes(quote.status);
  const canHold = ["PENDING", "IN_PROGRESS"].includes(quote.status);
  const canCancel = !["COMPLETED", "CANCELLED", "PURCHASED"].includes(quote.status);
  const canConvert = ["COMPLETED", "RESPONDED"].includes(quote.status);

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

        {/* 벤더 응답 */}
        {quote.vendorResponses && quote.vendorResponses.length > 0 && (
          <View className="mx-4 mt-4">
            <Text className="text-sm font-bold text-slate-900 mb-2">
              벤더 응답 ({quote.vendorResponses.length}건)
            </Text>
            {quote.vendorResponses.map((vr, idx) => (
              <View
                key={vr.id || idx}
                className="bg-white rounded-xl border border-slate-200 p-3.5 mb-2"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm font-semibold text-slate-800">
                    {vr.vendorName}
                  </Text>
                  <Text className="text-sm font-bold text-blue-600">
                    {formatAmount(vr.totalAmount)}
                  </Text>
                </View>
                <View className="flex-row gap-3">
                  {vr.deliveryDays && (
                    <View className="flex-row items-center gap-1">
                      <Truck size={12} color="#94a3b8" />
                      <Text className="text-xs text-slate-500">
                        납기 {vr.deliveryDays}일
                      </Text>
                    </View>
                  )}
                  {vr.notes && (
                    <Text className="text-xs text-slate-400">{vr.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

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

        {/* 메모 입력 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <MessageSquare size={14} color="#94a3b8" />
              <Text className="text-sm font-bold text-slate-900">메모</Text>
            </View>
            {memoEdited && (
              <Pressable
                className="bg-blue-600 rounded-lg px-3 py-1.5"
                onPress={handleSaveMemo}
                disabled={updateMemo.isPending}
              >
                {updateMemo.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-xs font-semibold text-white">저장</Text>
                )}
              </Pressable>
            )}
          </View>
          <TextInput
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 min-h-[80px]"
            placeholder="메모를 입력하세요..."
            multiline
            textAlignVertical="top"
            value={memo}
            onChangeText={(text) => {
              setMemo(text);
              setMemoEdited(true);
            }}
          />
        </View>

        {/* 구매 전환 버튼 */}
        {canConvert && (
          <View className="mx-4 mt-4">
            <Pressable
              className="bg-emerald-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
              onPress={handleConvertToOrder}
              disabled={convertToOrder.isPending}
            >
              {convertToOrder.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <ShoppingCart size={16} color="white" />
                  <Text className="text-sm font-semibold text-white">
                    구매 주문으로 전환
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 바 */}
      {(canApprove || canHold || canCancel) && (
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
      )}
    </View>
  );
}
