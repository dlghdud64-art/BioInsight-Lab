import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, Package, User, MessageSquare, ShoppingCart, Truck, ChevronRight, Edit3, RefreshCw, Clock, ArrowRight } from "lucide-react-native";
import { useQuoteDetail, useQuoteHistory } from "../../hooks/useApi";
import type { QuoteStatusHistory } from "../../types";
import { StatusBadge } from "../../components/StatusBadge";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (n == null) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  PENDING: "대기",
  IN_PROGRESS: "진행중",
  COMPLETED: "완료",
  CANCELLED: "취소",
  ON_HOLD: "보류",
  PURCHASED: "구매전환",
  RESPONDED: "응답완료",
};

function StatusLabel({ status }: { status: string | null }) {
  if (!status) return <Text className="text-xs text-slate-400">-</Text>;
  return (
    <Text className="text-xs font-semibold text-slate-700">
      {STATUS_LABEL[status] || status}
    </Text>
  );
}

function TimelineItem({ item, isLast }: { item: QuoteStatusHistory; isLast: boolean }) {
  return (
    <View className="flex-row">
      {/* 타임라인 도트 + 선 */}
      <View className="items-center mr-3" style={{ width: 16 }}>
        <View className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-200 mt-1" />
        {!isLast && <View className="w-0.5 flex-1 bg-slate-200 mt-1" />}
      </View>

      {/* 내용 */}
      <View className="flex-1 pb-4">
        <View className="flex-row items-center gap-1.5 mb-1">
          <StatusLabel status={item.previousStatus} />
          <ArrowRight size={10} color="#94a3b8" />
          <StatusLabel status={item.newStatus} />
        </View>
        {item.reason && (
          <Text className="text-xs text-slate-500 mb-0.5">{item.reason}</Text>
        )}
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] text-slate-400">{item.changedBy}</Text>
          <Text className="text-[10px] text-slate-400">{formatDate(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function QuoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: quote, isLoading, isError, refetch } = useQuoteDetail(id);
  const { data: history } = useQuoteHistory(id);

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
            {quote.vendorResponses.map((vr: any, idx: number) => (
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
          {(quote.items ?? []).map((item: any, idx: number) => (
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

        {/* 메모 미리보기 */}
        <Pressable
          className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4 flex-row items-center justify-between"
          onPress={() => router.push({ pathname: "/quotes/memo", params: { id } })}
        >
          <View className="flex-row items-center gap-2 flex-1">
            <MessageSquare size={14} color="#94a3b8" />
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900">메모</Text>
              <Text className="text-xs text-slate-400 mt-0.5" numberOfLines={1}>
                {quote.description || "메모를 입력하세요..."}
              </Text>
            </View>
          </View>
          <Edit3 size={16} color="#94a3b8" />
        </Pressable>

        {/* 상태 변경 이력 */}
        {history && history.length > 0 && (
          <View className="mx-4 mt-4 mb-4">
            <View className="flex-row items-center gap-1.5 mb-3">
              <Clock size={14} color="#475569" />
              <Text className="text-sm font-bold text-slate-900">상태 변경 이력</Text>
            </View>
            <View className="bg-white rounded-xl border border-slate-200 p-4">
              {history.map((h, idx) => (
                <TimelineItem key={h.id} item={h} isLast={idx === history.length - 1} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 바 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8 gap-2">
        {/* 상태 변경 */}
        <Pressable
          className="flex-row items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200"
          onPress={() => router.push({ pathname: "/quotes/status-change", params: { id } })}
        >
          <View className="flex-row items-center gap-2">
            <RefreshCw size={16} color="#475569" />
            <Text className="text-sm font-semibold text-slate-700">상태 변경</Text>
          </View>
          <ChevronRight size={16} color="#94a3b8" />
        </Pressable>

        {/* 주문 전환 */}
        {canConvert && (
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-emerald-600 rounded-xl py-3.5"
            onPress={() => router.push({ pathname: "/quotes/order-confirm", params: { id } })}
          >
            <ShoppingCart size={16} color="white" />
            <Text className="text-sm font-semibold text-white">구매 주문으로 전환</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
