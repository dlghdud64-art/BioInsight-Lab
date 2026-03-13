import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { ClipboardCheck } from "lucide-react-native";

export default function PurchaseCreateReviewScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-4">
        <ClipboardCheck size={24} color="#2563eb" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">등록 리뷰</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        입력한 구매 내역을 최종 확인합니다.
      </Text>
      <Pressable
        className="bg-blue-600 rounded-xl px-6 py-3"
        onPress={() => router.push("/purchases/register")}
      >
        <Text className="text-sm font-semibold text-white">구매 등록으로 이동</Text>
      </Pressable>
    </View>
  );
}
