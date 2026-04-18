import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Calendar, Store, Tag, Package, FileText, RefreshCw, ArrowDownToLine, CheckCircle } from "lucide-react-native";
import { usePurchaseDetail, lookupInventory, useCreateInventory } from "../../hooks/useApi";
import { ErrorState } from "../../components/ErrorState";
import { iconColor, spinnerColor } from "../../theme/colors";
import { getErrorMessage } from "../../lib/errorMessages";

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
        <ActivityIndicator color={spinnerColor} />
      </View>
    );
  }

  if (isError || !record) {
    return (
      <View className="flex-1 bg-white">
        <ErrorState
          title="불러오기 실패"
          description="구매 정보를 가져올 수 없습니다."
          onRetry={() => refetch()}
        />
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

  const createInventory = useCreateInventory();
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleReflectToInventory = async () => {
    setIsLookingUp(true);
    try {
      // 1. 기존 재고 검색
      let inventoryId = await lookupInventory({
        catalogNumber: record.catalogNumber || undefined,
        productName: record.productName,
      });

      // 2. 없으면 자동 생성
      if (!inventoryId) {
        const created = await createInventory.mutateAsync({
          productName: record.productName,
          catalogNumber: record.catalogNumber || undefined,
          unit: record.unit || "ea",
          currentQuantity: 0,
        });
        inventoryId = created?.id;
      }

      if (!inventoryId) {
        Alert.alert("오류", "재고 항목을 생성할 수 없습니다. 다시 시도해주세요.");
        return;
      }

      // 3. lot-receive로 직접 이동 (수량 prefill)
      router.push({
        pathname: "/inventory/lot-receive",
        params: {
          id: inventoryId,
          prefillQty: String(record.quantity || ""),
          purchaseId: record.id,
        },
      });
    } catch (err) {
      Alert.alert("오류", getErrorMessage(err));
    } finally {
      setIsLookingUp(false);
    }
  };

  const isReflected = record.followUpStatus === "inventory_reflected";

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
                <item.icon size={16} color={iconColor.secondary} />
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
              <FileText size={14} color={iconColor.muted} />
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
        {isReflected ? (
          <View className="flex-1 flex-row items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl py-3">
            <CheckCircle size={16} color={iconColor.success} />
            <Text className="text-sm font-semibold text-emerald-700">입고 완료</Text>
          </View>
        ) : (
          <Pressable
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
              isLookingUp ? "bg-emerald-400" : "bg-emerald-600"
            }`}
            onPress={handleReflectToInventory}
            disabled={isLookingUp}
          >
            {isLookingUp ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <ArrowDownToLine size={16} color="white" />
                <Text className="text-sm font-semibold text-white">재고 입고</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
