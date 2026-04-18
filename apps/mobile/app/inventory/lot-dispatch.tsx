import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { ArrowUpFromLine, AlertTriangle } from "lucide-react-native";
import { useConsumeInventory } from "../../hooks/useApi";
import { getErrorMessage } from "../../lib/errorMessages";

const REASONS = [
  { key: "experiment", label: "실험 사용" },
  { key: "transfer", label: "타 부서 이관" },
  { key: "disposal", label: "폐기" },
  { key: "sample", label: "샘플 제공" },
  { key: "other", label: "기타" },
];

export default function LotDispatchScreen() {
  const { id, lotNumber, lotQty, lotUnit } = useLocalSearchParams<{
    id: string;
    lotNumber?: string;
    lotQty?: string;
    lotUnit?: string;
  }>();
  const consume = useConsumeInventory();

  const currentQty = parseInt(lotQty || "0", 10);
  const unit = lotUnit || "ea";

  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const enteredQty = parseInt(qty, 10) || 0;
  const overLimit = enteredQty > currentQty;

  const handleSave = () => {
    if (isNaN(enteredQty) || enteredQty <= 0) {
      Alert.alert("오류", "올바른 수량을 입력하세요.");
      return;
    }
    if (overLimit) {
      Alert.alert("오류", `현재 수량(${currentQty})보다 많이 출고할 수 없습니다.`);
      return;
    }
    if (!reason) {
      Alert.alert("오류", "출고 사유를 선택하세요.");
      return;
    }

    const reasonLabel = REASONS.find((r) => r.key === reason)?.label || reason;
    const noteText = [
      `출고사유: ${reasonLabel}`,
      lotNumber && `Lot: ${lotNumber}`,
      notes,
    ].filter(Boolean).join(" | ");

    consume.mutate(
      { id, quantity: enteredQty, notes: noteText },
      {
        onSuccess: () => {
          Alert.alert("완료", `${enteredQty} ${unit} 출고 처리되었습니다.`, [
            { text: "확인", onPress: () => router.back() },
          ]);
        },
        onError: (err) => Alert.alert("오류", getErrorMessage(err)),
      }
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <View className="flex-row items-center gap-2 mb-1">
          <ArrowUpFromLine size={16} color="#2563eb" />
          <Text className="text-sm font-bold text-blue-700">출고 등록</Text>
        </View>
        <Text className="text-xs text-blue-600">
          {lotNumber || "Lot 미지정"} · 현재 {currentQty} {unit}
        </Text>
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          출고 수량 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className={`border rounded-xl px-4 py-3 text-sm text-slate-800 ${
            overLimit ? "border-red-400" : "border-slate-200"
          }`}
          placeholder="수량 입력"
          keyboardType="numeric"
          value={qty}
          onChangeText={setQty}
          autoFocus
        />
        {overLimit && (
          <View className="flex-row items-center gap-1 mt-1.5">
            <AlertTriangle size={12} color="#ef4444" />
            <Text className="text-xs text-red-500">
              현재 수량({currentQty})을 초과합니다
            </Text>
          </View>
        )}
        {enteredQty > 0 && enteredQty === currentQty && (
          <Text className="text-xs text-amber-600 mt-1.5">
            전량 출고됩니다. 이 Lot은 소진 상태가 됩니다.
          </Text>
        )}
      </View>

      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          출고 사유 <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {REASONS.map((r) => (
            <Pressable
              key={r.key}
              className={`px-3 py-2 rounded-lg border ${
                reason === r.key
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-slate-200"
              }`}
              onPress={() => setReason(r.key)}
            >
              <Text
                className={`text-xs font-medium ${
                  reason === r.key ? "text-white" : "text-slate-600"
                }`}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
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
        className={`rounded-xl py-3.5 items-center ${
          overLimit ? "bg-slate-200" : "bg-blue-600"
        }`}
        onPress={handleSave}
        disabled={consume.isPending || overLimit}
      >
        {consume.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className={`text-sm font-semibold ${overLimit ? "text-slate-400" : "text-white"}`}>
            출고 처리
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
