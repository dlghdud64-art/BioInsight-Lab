import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Calendar, Store, Tag, Package, FileText } from "lucide-react-native";
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
  const { data: record, isLoading } = usePurchaseDetail(id);

  if (isLoading || !record) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  const details = [
    { icon: Store, label: "벤더", value: record.vendor || "-" },
    { icon: Tag, label: "카테고리", value: record.category || "-" },
    { icon: Package, label: "수량", value: record.quantity ? `${record.quantity} ${record.unit || "ea"}` : "-" },
    { icon: Calendar, label: "구매일", value: formatDate(record.purchasedAt) },
  ];

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
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
  );
}
