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
  Printer,
  Navigation,
} from "lucide-react-native";
import {
  useInventoryDetail,
  useRestockInventory,
  useConsumeInventory,
  useUpdateInventoryLocation,
} from "../../hooks/useApi";
import { StatusBadge } from "../../components/StatusBadge";
import { DatePicker } from "../../components/DatePicker";
import { useState } from "react";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
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
  onLocation,
  onLabel,
}: {
  lot: InventoryLot;
  onRestock: (lot: InventoryLot) => void;
  onConsume: (lot: InventoryLot) => void;
  onLocation: (lot: InventoryLot) => void;
  onLabel: (lot: InventoryLot) => void;
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

      {/* 3행: 액션 버튼 4개 */}
      <View className="flex-row gap-2">
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg py-2"
          onPress={() => onRestock(lot)}
        >
          <ArrowDownToLine size={13} color="#059669" />
          <Text className="text-xs font-semibold text-emerald-700">입고</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-blue-50 border border-blue-200 rounded-lg py-2"
          onPress={() => onConsume(lot)}
        >
          <ArrowUpFromLine size={13} color="#2563eb" />
          <Text className="text-xs font-semibold text-blue-700">출고</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-slate-50 border border-slate-200 rounded-lg py-2"
          onPress={() => onLocation(lot)}
        >
          <Navigation size={13} color="#64748b" />
          <Text className="text-xs font-semibold text-slate-600">위치</Text>
        </Pressable>
        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1 bg-purple-50 border border-purple-200 rounded-lg py-2"
          onPress={() => onLabel(lot)}
        >
          <Printer size={13} color="#7c3aed" />
          <Text className="text-xs font-semibold text-purple-700">라벨</Text>
        </Pressable>
      </View>
    </View>
  );
}

type ModalMode = "restock" | "consume" | "location" | null;

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: inventory, isLoading } = useInventoryDetail(id);
  const restockMutation = useRestockInventory();
  const consumeMutation = useConsumeInventory();
  const locationMutation = useUpdateInventoryLocation();

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [actionLot, setActionLot] = useState<InventoryLot | null>(null);

  // Restock fields
  const [qty, setQty] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  // Location field
  const [newLocation, setNewLocation] = useState("");

  const resetFields = () => {
    setQty("");
    setLotNumber("");
    setExpiryDate(null);
    setNotes("");
    setNewLocation("");
  };

  const openRestock = (lot: InventoryLot) => {
    resetFields();
    setLotNumber(lot.lotNumber || "");
    setActionLot(lot);
    setModalMode("restock");
  };

  const openConsume = (lot: InventoryLot) => {
    resetFields();
    setActionLot(lot);
    setModalMode("consume");
  };

  const openLocation = (lot: InventoryLot) => {
    resetFields();
    setNewLocation(lot.location || "");
    setActionLot(lot);
    setModalMode("location");
  };

  const handleRestock = () => {
    const quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("오류", "올바른 수량을 입력하세요.");
      return;
    }
    restockMutation.mutate(
      {
        id,
        quantity,
        lotNumber: lotNumber || undefined,
        expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("완료", "입고 처리되었습니다.");
          setModalMode(null);
        },
        onError: () => Alert.alert("오류", "입고 처리에 실패했습니다."),
      }
    );
  };

  const handleConsume = () => {
    const quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("오류", "올바른 수량을 입력하세요.");
      return;
    }
    consumeMutation.mutate(
      { id, quantity, notes: notes || undefined },
      {
        onSuccess: () => {
          Alert.alert("완료", "출고 처리되었습니다.");
          setModalMode(null);
        },
        onError: () => Alert.alert("오류", "출고 처리에 실패했습니다."),
      }
    );
  };

  const handleLocationSave = () => {
    if (!newLocation.trim()) {
      Alert.alert("오류", "위치를 입력하세요.");
      return;
    }
    locationMutation.mutate(
      { id, location: newLocation.trim() },
      {
        onSuccess: () => {
          Alert.alert("완료", "위치가 변경되었습니다.");
          setModalMode(null);
        },
        onError: () => Alert.alert("오류", "위치 변경에 실패했습니다."),
      }
    );
  };

  const handlePrintLabel = async (lot: InventoryLot) => {
    const productName = inventory?.productName || inventory?.product?.name || "";
    const brand = inventory?.brand || inventory?.product?.brand || "";
    const html = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .label { border: 2px solid #333; border-radius: 8px; padding: 16px; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
            .brand { font-size: 12px; color: #666; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .key { color: #666; }
            .val { font-weight: 600; }
            .lot-big { font-size: 22px; font-weight: bold; text-align: center; margin: 12px 0; letter-spacing: 2px; }
            .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="title">${productName}</div>
            <div class="brand">${brand}</div>
            <div class="divider"></div>
            <div class="lot-big">${lot.lotNumber || "N/A"}</div>
            <div class="divider"></div>
            <div class="row"><span class="key">수량</span><span class="val">${lot.quantity} ${lot.unit}</span></div>
            <div class="row"><span class="key">유효기한</span><span class="val">${formatDate(lot.expiryDate)}</span></div>
            <div class="row"><span class="key">위치</span><span class="val">${lot.location || "-"}</span></div>
            <div class="row"><span class="key">보관조건</span><span class="val">${lot.storageCondition || "-"}</span></div>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      } else {
        Alert.alert("완료", "라벨이 PDF로 생성되었습니다.");
      }
    } catch {
      Alert.alert("오류", "라벨 생성에 실패했습니다.");
    }
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
                onRestock={openRestock}
                onConsume={openConsume}
                onLocation={openLocation}
                onLabel={handlePrintLabel}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* 입고 모달 */}
      <Modal visible={modalMode === "restock"} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setModalMode(null)}>
          <Pressable className="bg-white rounded-t-2xl px-5 pt-5 pb-10" onPress={() => {}}>
            <Text className="text-base font-bold text-slate-900 mb-1">입고 처리</Text>
            <Text className="text-xs text-slate-500 mb-4">
              {actionLot?.lotNumber || "Lot 미지정"} · 현재 {actionLot?.quantity ?? 0} {actionLot?.unit}
            </Text>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">입고 수량 *</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-3"
              placeholder="수량 입력"
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              autoFocus
            />

            <Text className="text-sm font-medium text-slate-700 mb-1.5">Lot 번호</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-3"
              placeholder="Lot 번호 입력"
              value={lotNumber}
              onChangeText={setLotNumber}
            />

            <Text className="text-sm font-medium text-slate-700 mb-1.5">유효기한</Text>
            <DatePicker
              value={expiryDate ?? new Date()}
              onChange={setExpiryDate}
              placeholder="유효기한 선택"
            />

            <View className="h-3" />

            <Text className="text-sm font-medium text-slate-700 mb-1.5">비고</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-4"
              placeholder="비고 입력 (선택)"
              value={notes}
              onChangeText={setNotes}
            />

            <View className="flex-row gap-3">
              <Pressable className="flex-1 bg-slate-100 rounded-xl py-3 items-center" onPress={() => setModalMode(null)}>
                <Text className="text-sm font-semibold text-slate-600">취소</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-emerald-600 rounded-xl py-3 items-center"
                onPress={handleRestock}
                disabled={restockMutation.isPending}
              >
                {restockMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">입고 확인</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 출고 모달 */}
      <Modal visible={modalMode === "consume"} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setModalMode(null)}>
          <Pressable className="bg-white rounded-t-2xl px-5 pt-5 pb-10" onPress={() => {}}>
            <Text className="text-base font-bold text-slate-900 mb-1">출고 처리</Text>
            <Text className="text-xs text-slate-500 mb-4">
              {actionLot?.lotNumber || "Lot 미지정"} · 현재 {actionLot?.quantity ?? 0} {actionLot?.unit}
            </Text>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">출고 수량 *</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-3"
              placeholder="수량 입력"
              keyboardType="numeric"
              value={qty}
              onChangeText={setQty}
              autoFocus
            />

            <Text className="text-sm font-medium text-slate-700 mb-1.5">비고</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-4"
              placeholder="비고 입력 (선택)"
              value={notes}
              onChangeText={setNotes}
            />

            <View className="flex-row gap-3">
              <Pressable className="flex-1 bg-slate-100 rounded-xl py-3 items-center" onPress={() => setModalMode(null)}>
                <Text className="text-sm font-semibold text-slate-600">취소</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                onPress={handleConsume}
                disabled={consumeMutation.isPending}
              >
                {consumeMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">출고 확인</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 위치 변경 모달 */}
      <Modal visible={modalMode === "location"} transparent animationType="slide">
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setModalMode(null)}>
          <Pressable className="bg-white rounded-t-2xl px-5 pt-5 pb-10" onPress={() => {}}>
            <Text className="text-base font-bold text-slate-900 mb-1">위치 변경</Text>
            <Text className="text-xs text-slate-500 mb-4">
              {actionLot?.lotNumber || "Lot 미지정"}
            </Text>

            <Text className="text-sm font-medium text-slate-700 mb-1.5">보관 위치</Text>
            <TextInput
              className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 mb-4"
              placeholder="예: 냉장고 A-2, 시약장 B-1"
              value={newLocation}
              onChangeText={setNewLocation}
              autoFocus
            />

            <View className="flex-row gap-3">
              <Pressable className="flex-1 bg-slate-100 rounded-xl py-3 items-center" onPress={() => setModalMode(null)}>
                <Text className="text-sm font-semibold text-slate-600">취소</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-slate-800 rounded-xl py-3 items-center"
                onPress={handleLocationSave}
                disabled={locationMutation.isPending}
              >
                {locationMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-sm font-semibold text-white">저장</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
