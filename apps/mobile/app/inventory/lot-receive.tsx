import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { CheckCircle, Printer, MapPin, ArrowDownToLine } from "lucide-react-native";
import { useRestockInventory, useInventoryDetail } from "../../hooks/useApi";
import { DatePicker } from "../../components/DatePicker";

type Step = "form" | "done";

export default function LotReceiveScreen() {
  const { id, lotNumber: initLot } = useLocalSearchParams<{
    id: string;
    lotNumber?: string;
  }>();
  const { data: inventory } = useInventoryDetail(id);
  const restock = useRestockInventory();

  const [step, setStep] = useState<Step>("form");
  const [qty, setQty] = useState("");
  const [lotNumber, setLotNumber] = useState(initLot || "");
  const [location, setLocation] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  const productName = inventory?.productName || inventory?.product?.name || "";

  const handleSave = () => {
    const quantity = parseInt(qty, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert("오류", "올바른 수량을 입력하세요.");
      return;
    }
    if (!lotNumber.trim()) {
      Alert.alert("오류", "Lot 번호를 입력하세요.");
      return;
    }

    restock.mutate(
      {
        id,
        quantity,
        lotNumber: lotNumber.trim(),
        expiryDate: expiryDate ? expiryDate.toISOString() : undefined,
        notes: [location && `위치: ${location}`, notes].filter(Boolean).join(" | ") || undefined,
      },
      {
        onSuccess: () => setStep("done"),
        onError: () => Alert.alert("오류", "입고 처리에 실패했습니다."),
      }
    );
  };

  if (step === "done") {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-5">
          <CheckCircle size={32} color="#059669" />
        </View>
        <Text className="text-xl font-bold text-slate-900 mb-1">입고 완료</Text>
        <Text className="text-sm text-slate-500 text-center mb-1">{productName}</Text>
        <Text className="text-xs text-slate-400 mb-6">
          Lot {lotNumber} · {qty} {inventory?.unit || "ea"} 입고
        </Text>

        <View className="w-full gap-3">
          <Pressable
            className="flex-row items-center justify-center gap-2 bg-purple-600 rounded-xl py-3.5"
            onPress={() =>
              router.replace({
                pathname: "/inventory/lot-label",
                params: {
                  id,
                  lotNumber,
                  lotQty: qty,
                  lotUnit: inventory?.unit || "ea",
                  lotExpiry: expiryDate?.toISOString() || "",
                  lotLocation: location,
                  lotStorage: "",
                },
              })
            }
          >
            <Printer size={16} color="white" />
            <Text className="text-sm font-semibold text-white">라벨 인쇄</Text>
          </Pressable>

          <Pressable
            className="flex-row items-center justify-center gap-2 bg-slate-700 rounded-xl py-3.5"
            onPress={() =>
              router.replace({
                pathname: "/inventory/lot-location",
                params: { id, lotNumber, lotLocation: location, lotStorage: "" },
              })
            }
          >
            <MapPin size={16} color="white" />
            <Text className="text-sm font-semibold text-white">위치 지정</Text>
          </Pressable>

          <Pressable
            className="flex-row items-center justify-center gap-2 border border-slate-200 rounded-xl py-3.5"
            onPress={() => router.dismissAll()}
          >
            <Text className="text-sm font-semibold text-slate-600">재고 목록</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
        <View className="flex-row items-center gap-2 mb-1">
          <ArrowDownToLine size={16} color="#059669" />
          <Text className="text-sm font-bold text-emerald-700">입고 등록</Text>
        </View>
        <Text className="text-xs text-emerald-600">{productName}</Text>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          Lot 번호 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="예: LOT-2024-001"
          value={lotNumber}
          onChangeText={setLotNumber}
          autoFocus={!initLot}
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          입고 수량 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="수량 입력"
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
          autoFocus={!!initLot}
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">유효기한</Text>
        <DatePicker
          value={expiryDate ?? new Date()}
          onChange={setExpiryDate}
          placeholder="유효기한 선택"
        />
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">보관 위치</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="예: 냉장고 A-2"
          value={location}
          onChangeText={setLocation}
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">비고</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="추가 메모 (선택)"
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <Pressable
        className="bg-emerald-600 rounded-xl py-3.5 items-center"
        onPress={handleSave}
        disabled={restock.isPending}
      >
        {restock.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-sm font-semibold text-white">입고 처리</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
