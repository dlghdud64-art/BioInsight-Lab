import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, User } from "lucide-react-native";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export default function ProfileScreen() {
  const handleLogout = async () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠습니까?", [
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
      <View className="flex-1 p-5">
        <Text className="text-xl font-bold text-slate-900 mb-6">내 정보</Text>

        {/* 프로필 카드 */}
        <View className="bg-white rounded-2xl p-5 border border-slate-200 mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
              <User size={24} color="#2563eb" />
            </View>
            <View>
              <Text className="font-semibold text-slate-900">사용자</Text>
              <Text className="text-sm text-slate-500">BioInsight Lab 멤버</Text>
            </View>
          </View>
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          className="flex-row items-center gap-3 bg-white rounded-2xl p-4 border border-slate-200"
          onPress={handleLogout}
        >
          <LogOut size={20} color="#ef4444" />
          <Text className="text-red-500 font-medium">로그아웃</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
