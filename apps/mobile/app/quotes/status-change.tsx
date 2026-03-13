import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { RefreshCw } from "lucide-react-native";

export default function QuoteStatusChangeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-amber-50 items-center justify-center mb-4">
        <RefreshCw size={24} color="#f59e0b" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">견적 상태 변경</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        견적의 진행 상태를 변경합니다.
      </Text>
      <Pressable
        className="bg-blue-600 rounded-xl px-6 py-3"
        onPress={() => id ? router.push(`/quotes/${id}`) : router.back()}
      >
        <Text className="text-sm font-semibold text-white">견적 상세로 이동</Text>
      </Pressable>
    </View>
  );
}
