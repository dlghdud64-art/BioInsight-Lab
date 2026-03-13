import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { LogOut, Info } from "lucide-react-native";

export default function MoreScreen() {
  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("accessToken");
          await SecureStore.deleteItemAsync("refreshToken");
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">더보기</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 로그아웃 */}
        <Pressable
          className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 flex-row items-center p-4"
          onPress={handleLogout}
        >
          <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3">
            <LogOut size={20} color="#ef4444" />
          </View>
          <Text className="text-sm font-semibold text-red-600">로그아웃</Text>
        </Pressable>

        {/* 앱 정보 */}
        <View className="items-center mt-8 mb-4">
          <View className="flex-row items-center gap-1.5">
            <Info size={14} color="#cbd5e1" />
            <Text className="text-xs text-slate-400">
              BioInsight Lab v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
