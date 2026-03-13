import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  MapPin,
  Calendar,
  Thermometer,
  ArrowDownToLine,
  ArrowUpFromLine,
  Tag,
} from "lucide-react-native";
import { useInventoryDetail, useRestockInventory, useConsumeInventory } from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { useState } from "react";
import type { InventoryLot } from "../../types";

function formatDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function LotCard({
  lot,
  onRestock,
  onConsume,
}: {
  lot: InventoryLot;
  onRestock: (lot: InventoryLot) => void;
  onConsume: (lot: InventoryLot) => void;
}) {
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

  return (
    <View className={`rounded-xl border p-3.5 mb-3 ${borderColor}`}>
      {/* 1행: Lot 번호 + 수량 */}
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

      {/* 2행: 메타 정보 */}
      <View className="flex-row flex-wrap gap-x-4 gap-y-1 mb-3">
        {lot.storageCondition && (
          <View className="flex-row items-center gap-1">
            <Thermometer size={12} color="#94a3b8" />
            <Text className="text-xs text-slate-500">{lot.storageCondition}</Text>
          </View>
        )}
        {lot.location && (
          <View className="flex-row items-center gap-1">
            <MapPin size={12} color="#94a3b8" />
            <Text className="text-xs text-slate-500">{lot.location}</Text>
          </View>
        )}
        {lot.expiryDate && (
          <View className="flex-row items-center gap-1">
            <Calendar size={12} color={isExpired ? "#ef4444" : isExpiringSoon ? "#f59e0b" : "#94a3b8"} />
            <Text
              className={`text-xs ${
                isExpired
                  ? "text-red-600 font-semibold"
                  : isExpiringSoon
                    ? "text-amber-600 font-semibold"
                    : "text-slate-500"
              }`}
            >
              {formatDate(lot.expiryDate)}
              {isExpired ? " (만료)" : isExpiringSoon ? " (임박)" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* 3행: 액션 버튼 */}
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg py-2"
          onPress={() => onRestock(lot)}
        >
          <ArrowDownToLine size={14} color="#059669" />
          <Text className="text-xs font-semibold text-emerald-700">입고</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg py-2"
          onPress={() => onConsume(lot)}
        >
          <ArrowUpFromLine size={14} color="#2563eb" />
          <Text className="text-xs font-semibold text-blue-700">출고</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ActionMode = "restock" | "consume" | null;

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inventory, isLoading } = useInventoryDetail(id);
  const restockMutation = useRestockInventory();
  const consumeMutation = useConsumeInventory();

  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [actionLot, setActionLot] = useState<InventoryLot | null>(null);
  const [qty, setQty] = useState("");

  const openAction = (mode: ActionMode, lot: InventoryLot) => {
    setActionMode(mode);
    setActionLot(lot);
    setQty("");
  };

  const handleAction = () => {
    const quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("오류", "올바른 수량을 입력하세요.");
      return;
    }

    const mutation = actionMode === "restock" ? restockMutation : consumeMutation;
    mutation.mutate(
      { id, quantity },
      {
        onSuccess: () => {
          Alert.alert("완료", actionMode === "restock" ? "입고 처리되었습니다." : "출고 처리되었습니다.");
          setActionMode(null);
          setActionLot(null);
        },
        onError: () => {
          Alert.alert("오류", "처리에 실패했습니다.");
        },
      }
    );
  };

  if (isLoading || !inventory) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 제품 정보 헤더 */}
        <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 p-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-2">
              <Text className="text-base font-bold text-slate-900">
                {inventory.productName || inventory.product?.name}
              </Text>
              {(inventory.brand || inventory.product?.brand) && (
                <Text className="text-xs text-slate-500 mt-0.5">
                  {inventory.brand || inventory.product?.brand}
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
                <Text className="text-xs font-normal text-slate-500">
                  {inventory.unit}
                </Text>
              </Text>
            </View>
            {inventory.safetyStock && (
              <View>
                <Text className="text-xs text-slate-400">안전 재고</Text>
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
              <Text className="text-sm text-slate-400">
                등록된 Lot이 없습니다.
              </Text>
            </View>
          ) : (
            (inventory.lots ?? []).map((lot, idx) => (
              <LotCard
                key={lot.id || idx}
                lot={lot}
                onRestock={(l) => openAction("restock", l)}
                onConsume={(l) => openAction("consume", l)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* 입고/출고 모달 */}
      <Modal visible={actionMode !== null} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setActionMode(null)}
        >
          <Pressable
            className="bg-white rounded-t-2xl px-5 pt-5 pb-10"
            onPress={() => {}}
          >
            <Text className="text-base font-bold text-slate-900 mb-1">
              {actionMode === "restock" ? "입고 처리" : "출고 처리"}
            </Text>
            <Text className="text-xs text-slate-500 mb-4">
              {actionLot?.lotNumber || "Lot 미지정"} · 현재 수량: {actionLot?.quantity ?? 0} {actionLot?.unit}
            </Text>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">
              {actionMode === "restock" ? "입고 수량" : "출고 수량"}
            </Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-4"
              placeholder="수량 입력"
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              autoFocus
            />

            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 bg-slate-100 rounded-xl py-3 items-center"
                onPress={() => setActionMode(null)}
              >
                <Text className="text-sm font-semibold text-slate-600">취소</Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-xl py-3 items-center ${
                  actionMode === "restock" ? "bg-emerald-600" : "bg-blue-600"
                }`}
                onPress={handleAction}
                disabled={restockMutation.isPending || consumeMutation.isPending}
              >
                {restockMutation.isPending || consumeMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">
                    {actionMode === "restock" ? "입고 확인" : "출고 확인"}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
