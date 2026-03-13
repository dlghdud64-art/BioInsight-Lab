import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { HelpCircle } from "lucide-react-native";

export default function SupportScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-emerald-50 items-center justify-center mb-4">
        <HelpCircle size={24} color="#059669" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">고객 지원</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        문의사항이나 피드백을 남겨주세요.
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
