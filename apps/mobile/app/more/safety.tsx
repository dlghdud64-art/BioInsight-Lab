import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Shield } from "lucide-react-native";

export default function SafetyScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-4">
        <Shield size={24} color="#ef4444" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">안전 관리</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        시약 안전 정보와 MSDS를 관리합니다.
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
