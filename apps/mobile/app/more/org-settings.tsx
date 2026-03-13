import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Settings } from "lucide-react-native";

export default function OrganizationSettingsScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <View className="w-14 h-14 rounded-full bg-slate-100 items-center justify-center mb-4">
        <Settings size={24} color="#64748b" />
      </View>
      <Text className="text-lg font-bold text-slate-900 mb-1">조직 설정</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        조직 정보와 멤버 권한을 관리합니다.
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
