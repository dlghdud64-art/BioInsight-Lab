import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, Store, Tag, Package, FileText, RefreshCw, ArrowDownToLine } from "lucide-react-native";
import { usePurchaseDetail } from "../../hooks/useApi";

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(n?: number) {
  if (!n && n !== 0) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: record, isLoading, isError, refetch } = usePurchaseDetail(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError || !record) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-bold text-slate-900 mb-1">불러오기 실패</Text>
        <Text className="text-sm text-slate-500 text-center mb-4">구매 정보를 가져올 수 없습니다.</Text>
        <Pressable className="bg-blue-600 rounded-xl px-6 py-3" onPress={() => refetch()}>
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const details = [
    { icon: Store, label: "벤더", value: record.vendor || "-" },
    { icon: Tag, label: "카테고리", value: record.category || "-" },
    { icon: Package, label: "수량", value: record.quantity ? `${record.quantity} ${record.unit || "ea"}` : "-" },
    { icon: Calendar, label: "구매일", value: formatDate(record.purchasedAt) },
  ];

  const handleRepurchase = () => {
    const params = new URLSearchParams({
      prefill: "1",
      productName: record.productName,
      ...(record.vendor && { vendor: record.vendor }),
      ...(record.amount && { amount: String(record.amount) }),
      ...(record.unit && { unit: record.unit }),
    });
    router.push(`/purchases/register?${params.toString()}` as any);
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 제품 정보 헤더 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <Text className="text-base font-bold text-slate-900 mb-1">
            {record.productName}
          </Text>
          {record.catalogNumber && (
            <Text className="text-xs text-slate-400 mb-3">
              Cat. {record.catalogNumber}
            </Text>
          )}
          <View className="border-t border-slate-100 pt-3">
            <Text className="text-xs text-slate-400">금액</Text>
            <Text className="text-2xl font-bold text-blue-600">
              {formatAmount(record.amount)}
            </Text>
          </View>
        </View>

        {/* 상세 정보 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4 gap-3">
          {details.map((item) => (
            <View key={item.label} className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-lg bg-slate-50 items-center justify-center">
                <item.icon size={16} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-slate-400">{item.label}</Text>
                <Text className="text-sm font-medium text-slate-800">{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 비고 */}
        {record.notes && (
          <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <FileText size={14} color="#94a3b8" />
              <Text className="text-sm font-bold text-slate-900">비고</Text>
            </View>
            <Text className="text-sm text-slate-600">{record.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* 하단 액션 바 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8 flex-row gap-3">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3"
          onPress={handleRepurchase}
        >
          <RefreshCw size={16} color="white" />
          <Text className="text-sm font-semibold text-white">재구매</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-2 bg-emerald-600 rounded-xl py-3"
          onPress={() => router.push("/(tabs)/inventory")}
        >
          <ArrowDownToLine size={16} color="white" />
          <Text className="text-sm font-semibold text-white">재고 입고</Text>
        </Pressable>
      </View>
    </View>
  );
}
