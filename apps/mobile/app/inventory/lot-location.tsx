import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { MapPin } from "lucide-react-native";

export default function LotLocationAssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-4">
        <MapPin size={24} color="#2563eb" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">위치 지정</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        Lot의 보관 위치를 지정하거나 변경합니다.
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
