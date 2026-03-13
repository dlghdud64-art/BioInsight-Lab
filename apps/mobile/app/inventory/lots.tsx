import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Layers } from "lucide-react-native";

export default function LotListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-4">
        <Layers size={24} color="#64748b" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">Lot 목록</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        재고 품목의 Lot 이력을 확인합니다.
      </Text>
      <Pressable
        className="bg-blue-600 rounded-xl px-6 py-3"
        onPress={() => id ? router.push(`/inventory/${id}`) : router.push("/(tabs)/inventory")}
      >
        <Text className="text-sm font-semibold text-white">재고 상세로 이동</Text>
      </Pressable>
    </View>
  );
}
