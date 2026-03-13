import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { CheckCircle } from "lucide-react-native";

export default function PurchaseCreateCompleteScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-4">
        <CheckCircle size={24} color="#059669" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">등록 완료</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        구매 내역이 성공적으로 등록되었습니다.
      </Text>
      <Pressable
        className="bg-blue-600 rounded-xl px-6 py-3"
        onPress={() => router.replace("/(tabs)/purchases")}
      >
        <Text className="text-sm font-semibold text-white">구매 목록으로 이동</Text>
      </Pressable>
    </View>
  );
}
