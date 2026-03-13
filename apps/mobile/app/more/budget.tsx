import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { PieChart } from "lucide-react-native";

export default function BudgetSummaryScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-4">
        <PieChart size={24} color="#2563eb" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">예산 요약</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        구매 지출과 예산 현황을 확인합니다.
      </Text>
      <Pressable
        className="border border-slate-200 rounded-xl px-6 py-3"
        onPress={() => router.back()}
      >
        <Text className="text-sm font-semibold text-slate-600">뒤로가기</Text>
      </Pressable>
    </View>
  );
}
