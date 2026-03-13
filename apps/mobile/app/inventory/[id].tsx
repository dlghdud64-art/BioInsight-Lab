import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  MapPin,
  Calendar,
  Thermometer,
  ArrowDownToLine,
  ArrowUpFromLine,
  Tag,
  Printer,
  Navigation,
  Plus,
} from "lucide-react-native";
import { useInventoryDetail } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import type { InventoryLot } from "../../types";

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function LotCard({ lot, inventoryId }: { lot: InventoryLot; inventoryId: string }) {
  const isExpired = lot.expiryDate && new Date(lot.expiryDate) < new Date();
  const isExpiringSoon =
    lot.expiryDate &&
    !isExpired &&
    new Date(lot.expiryDate).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  const borderColor = isExpired
    ? "border-red-300 bg-red-50/50"
    : isExpiringSoon
      ? "border-amber-300 bg-amber-50/30"
      : "border-slate-200 bg-white";

  const nav = (path: string) =>
    router.push({
      pathname: path as any,
      params: {
        id: inventoryId,
        lotNumber: lot.lotNumber || "",
        lotQty: String(lot.quantity),
        lotUnit: lot.unit,
        lotExpiry: lot.expiryDate || "",
        lotLocation: lot.location || "",
        lotStorage: lot.storageCondition || "",
      },
    });

  return (
    <View className={`rounded-xl border p-3.5 mb-3 ${borderColor}`}>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <Tag size={14} color="#64748b" />
          <Text className="text-sm font-semibold text-slate-800">
            {lot.lotNumber || "Lot 미지정"}
          </Text>
        </View>
        <Text className="text-lg font-bold text-slate-900">
          {lot.quantity}{" "}
          <Text className="text-xs font-normal text-slate-500">{lot.unit}</Text>
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3">
        {lot.storageCondition && (
          <View className="flex-row items-center gap-1">
            <Thermometer size={12} color="#94a3b8" />
            <Text className="text-xs text-slate-500">{lot.storageCondition}</Text>
          </View>
        )}
        <View className="flex-row items-center gap-1">
          <MapPin size={12} color={lot.location ? "#94a3b8" : "#ef4444"} />
          <Text className={`text-xs ${lot.location ? "text-slate-500" : "text-red-500"}`}>
            {lot.location || "위치 미지정"}
          </Text>
        </View>
        {lot.expiryDate && (
          <View className="flex-row items-center gap-1">
            <Calendar size={12} color={isExpired ? "#ef4444" : isExpiringSoon ? "#f59e0b" : "#94a3b8"} />
            <Text
              className={`text-xs ${
                isExpired ? "text-red-600 font-semibold"
                  : isExpiringSoon ? "text-amber-600 font-semibold"
                  : "text-slate-500"
              }`}
            >
              {formatDate(lot.expiryDate)}
              {isExpired ? " (만료)" : isExpiringSoon ? " (임박)" : ""}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg py-2"
          onPress={() => nav("/inventory/lot-receive")}
        >
          <ArrowDownToLine size={13} color="#059669" />
          <Text className="text-xs font-semibold text-emerald-700">입고</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-blue-50 border border-blue-200 rounded-lg py-2"
          onPress={() => nav("/inventory/lot-dispatch")}
        >
          <ArrowUpFromLine size={13} color="#2563eb" />
          <Text className="text-xs font-semibold text-blue-700">출고</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-slate-50 border border-slate-200 rounded-lg py-2"
          onPress={() => nav("/inventory/lot-location")}
        >
          <Navigation size={13} color="#64748b" />
          <Text className="text-xs font-semibold text-slate-600">위치</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-purple-50 border border-purple-200 rounded-lg py-2"
          onPress={() => nav("/inventory/lot-label")}
        >
          <Printer size={13} color="#7c3aed" />
          <Text className="text-xs font-semibold text-purple-700">라벨</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inventory, isLoading, isError, refetch } = useInventoryDetail(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError || !inventory) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base font-bold text-slate-900 mb-1">불러오기 실패</Text>
        <Text className="text-sm text-slate-500 text-center mb-4">재고 정보를 가져올 수 없습니다.</Text>
        <Pressable className="bg-blue-600 rounded-xl px-6 py-3" onPress={() => refetch()}>
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  const productName = inventory.productName || inventory.product?.name || "";
  const brand = inventory.brand || inventory.product?.brand || "";

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 제품 정보 헤더 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-slate-900">{productName}</Text>
              {brand && (
                <Text className="text-xs text-slate-500 mt-0.5">
                  {brand}
                  {(inventory.catalogNumber || inventory.product?.catalogNumber) &&
                    ` · ${inventory.catalogNumber || inventory.product?.catalogNumber}`}
                </Text>
              )}
            </View>
            <StatusBadge status={inventory.status} />
          </View>

          <View className="flex-row gap-6 mt-3 pt-3 border-t border-slate-100">
            <View>
              <Text className="text-xs text-slate-400">총 수량</Text>
              <Text className="text-xl font-bold text-slate-900">
                {inventory.quantity}{" "}
                <Text className="text-xs font-normal text-slate-500">{inventory.unit}</Text>
              </Text>
            </View>
            <View>
              <Text className="text-xs text-slate-400">Lot 수</Text>
              <Text className="text-base font-semibold text-slate-700">
                {inventory.lots?.length ?? 0}개
              </Text>
            </View>
            {inventory.safetyStock != null && (
              <View>
                <Text className="text-xs text-slate-400">안전재고</Text>
                <Text className="text-base font-semibold text-slate-700">
                  {inventory.safetyStock} {inventory.unit}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Lot 리스트 */}
        <View className="mx-4 mt-4">
          <Text className="text-sm font-bold text-slate-900 mb-2">
            Lot 목록 ({inventory.lots?.length ?? 0}개)
          </Text>
          {(inventory.lots ?? []).length === 0 ? (
            <View className="bg-white rounded-xl border border-slate-200 p-6 items-center">
              <Text className="text-sm text-slate-400 mb-3">등록된 Lot이 없습니다.</Text>
              <Pressable
                className="flex-row items-center gap-1.5 bg-emerald-600 rounded-xl px-5 py-2.5"
                onPress={() =>
                  router.push({ pathname: "/inventory/lot-receive", params: { id } })
                }
              >
                <Plus size={14} color="white" />
                <Text className="text-xs font-semibold text-white">첫 입고 등록</Text>
              </Pressable>
            </View>
          ) : (
            (inventory.lots ?? []).map((lot: InventoryLot, idx: number) => (
              <LotCard key={lot.id || idx} lot={lot} inventoryId={id} />
            ))
          )}
        </View>
      </ScrollView>

      {/* 하단 신규 입고 버튼 */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 pb-8">
        <Pressable
          className="flex-row items-center justify-center gap-2 bg-emerald-600 rounded-xl py-3.5"
          onPress={() =>
            router.push({ pathname: "/inventory/lot-receive", params: { id } })
          }
        >
          <Plus size={16} color="white" />
          <Text className="text-sm font-semibold text-white">신규 입고</Text>
        </Pressable>
      </View>
    </View>
  );
}
