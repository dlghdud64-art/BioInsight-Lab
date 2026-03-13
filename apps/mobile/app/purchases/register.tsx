import { View, Text, TextInput, ScrollView, Pressable, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { useCreatePurchase } from "../../hooks/useApi";
import { DatePicker } from "../../components/DatePicker";

export default function PurchaseRegisterScreen() {
  const [form, setForm] = useState({
    productName: "",
    vendor: "",
    amount: "",
    quantity: "",
    unit: "ea",
    category: "",
    notes: "",
  });
  const [purchaseDate, setPurchaseDate] = useState(new Date());

  const createPurchase = useCreatePurchase();

  const handleSave = () => {
    if (!form.productName.trim()) {
      Alert.alert("오류", "제품명을 입력하세요.");
      return;
    }
    if (!form.amount.trim() || isNaN(Number(form.amount))) {
      Alert.alert("오류", "금액을 올바르게 입력하세요.");
      return;
    }

    createPurchase.mutate(
      {
        productName: form.productName.trim(),
        vendor: form.vendor.trim() || undefined,
        amount: Number(form.amount),
        quantity: form.quantity ? Number(form.quantity) : undefined,
        unit: form.unit || "ea",
        category: form.category.trim() || undefined,
        purchasedAt: purchaseDate.toISOString(),
      },
      {
        onSuccess: () => {
          Alert.alert("완료", "구매 내역이 등록되었습니다.", [
            { text: "확인", onPress: () => router.back() },
          ]);
        },
        onError: () => {
          Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
        },
      }
    );
  };

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 제품명 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">
          제품명 <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="시약/장비명 입력"
          value={form.productName}
          onChangeText={(v) => update("productName", v)}
        />
      </View>

      {/* 벤더 */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">벤더</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="공급업체명"
          value={form.vendor}
          onChangeText={(v) => update("vendor", v)}
        />
      </View>

      {/* 금액 + 수량 */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">
            금액 (₩) <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="0"
            keyboardType="numeric"
            value={form.amount}
            onChangeText={(v) => update("amount", v)}
          />
        </View>
        <View className="w-24">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">수량</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="1"
            keyboardType="numeric"
            value={form.quantity}
            onChangeText={(v) => update("quantity", v)}
          />
        </View>
      </View>

      {/* 단위 + 카테고리 */}
      <View className="flex-row gap-3 mb-4">
        <View className="w-24">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">단위</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="ea"
            value={form.unit}
            onChangeText={(v) => update("unit", v)}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-slate-700 mb-1.5">카테고리</Text>
          <TextInput
            className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
            placeholder="시약, 소모품, 장비 등"
            value={form.category}
            onChangeText={(v) => update("category", v)}
          />
        </View>
      </View>

      {/* 구매일 */}
      <View className="mb-4">
        <DatePicker label="구매일" value={purchaseDate} onChange={setPurchaseDate} />
      </View>

      {/* 비고 */}
      <View className="mb-6">
        <Text className="text-sm font-medium text-slate-700 mb-1.5">비고</Text>
        <TextInput
          className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800"
          placeholder="추가 메모"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={form.notes}
          onChangeText={(v) => update("notes", v)}
        />
      </View>

      {/* 저장 버튼 */}
      <Pressable
        className="bg-blue-600 rounded-xl py-3.5 items-center"
        onPress={handleSave}
        disabled={createPurchase.isPending}
      >
        {createPurchase.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-sm font-semibold text-white">구매 내역 등록</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
