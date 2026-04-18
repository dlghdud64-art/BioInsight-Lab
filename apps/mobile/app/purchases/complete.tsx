import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { CheckCircle, ArrowDownToLine, Plus, List } from "lucide-react-native";
import { lookupInventory, useCreateInventory } from "../../hooks/useApi";
import { getErrorMessage } from "../../lib/errorMessages";

export default function PurchaseCompleteScreen() {
  const { count, total, purchaseId, productName, quantity, unit, catalogNumber } =
    useLocalSearchParams<{
      count?: string;
      total?: string;
      purchaseId?: string;
      productName?: string;
      quantity?: string;
      unit?: string;
      catalogNumber?: string;
    }>();

  const createInventory = useCreateInventory();
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleReflectToInventory = async () => {
    if (!purchaseId || !productName) {
      Alert.alert("안내", "구매 상세에서 재고 반영을 진행해주세요.");
      router.dismissAll();
      return;
    }

    setIsLookingUp(true);
    try {
      let inventoryId = await lookupInventory({
        catalogNumber: catalogNumber || undefined,
        productName,
      });

      if (!inventoryId) {
        const created = await createInventory.mutateAsync({
          productName,
          catalogNumber: catalogNumber || undefined,
          unit: unit || "ea",
          currentQuantity: 0,
        });
        inventoryId = created?.id;
      }

      if (!inventoryId) {
        Alert.alert("오류", "재고 항목을 생성할 수 없습니다. 다시 시도해주세요.");
        return;
      }

      router.replace({
        pathname: "/inventory/lot-receive",
        params: {
          id: inventoryId,
          prefillQty: quantity || "",
          purchaseId,
        },
      });
    } catch (err) {
      Alert.alert("오류", getErrorMessage(err));
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-5">
        <CheckCircle size={32} color="#059669" />
      </View>

      <Text className="text-xl font-bold text-slate-900 mb-1">등록 완료</Text>
      <Text className="text-sm text-slate-500 text-center mb-2">
        구매 내역이 성공적으로 등록되었습니다.
      </Text>

      {count && total && (
        <Text className="text-xs text-slate-400 mb-6">
          {count}건 · ₩{Number(total).toLocaleString("ko-KR")}
        </Text>
      )}

      <View className="w-full gap-3 mt-2">
        <Pressable
          className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
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

        <Pressable
          className="flex-row items-center justify-center gap-2 bg-blue-600 rounded-xl py-3.5"
          onPress={() => router.replace("/purchases/register")}
        >
          <Plus size={16} color="white" />
          <Text className="text-sm font-semibold text-white">추가 등록</Text>
        </Pressable>

        <Pressable
          className="flex-row items-center justify-center gap-2 border border-slate-200 rounded-xl py-3.5"
          onPress={() => router.dismissAll()}
        >
          <List size={16} color="#64748b" />
          <Text className="text-sm font-semibold text-slate-600">구매 목록</Text>
        </Pressable>
      </View>
    </View>
  );
}
