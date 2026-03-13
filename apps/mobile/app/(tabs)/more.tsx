import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  Shield,
  Wallet,
  Building2,
  User,
  LogOut,
  Info,
  ChevronRight,
} from "lucide-react-native";

const menuItems = [
  {
    icon: Shield,
    label: "안전관리",
    description: "위험물질 관리 · MSDS · 점검 기록",
    color: "#ef4444",
    onPress: () => {},
  },
  {
    icon: Wallet,
    label: "예산 요약",
    description: "예산 현황 · 소진율 · 리포트",
    color: "#3b82f6",
    onPress: () => {},
  },
  {
    icon: Building2,
    label: "조직 설정",
    description: "멤버 관리 · 권한 설정",
    color: "#8b5cf6",
    onPress: () => {},
  },
  {
    icon: User,
    label: "프로필",
    description: "내 정보 · 알림 설정",
    color: "#64748b",
    onPress: () => {},
  },
];

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
        {/* 메뉴 리스트 */}
        <View className="mt-4 mx-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {menuItems.map((item, idx) => (
            <Pressable
              key={item.label}
              className={`flex-row items-center p-4 ${
                idx < menuItems.length - 1 ? "border-b border-slate-100" : ""
              }`}
              onPress={item.onPress}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <item.icon size={20} color={item.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-800">
                  {item.label}
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  {item.description}
                </Text>
              </View>
              <ChevronRight size={16} color="#cbd5e1" />
            </Pressable>
          ))}
        </View>

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
