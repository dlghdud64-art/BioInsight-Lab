import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  LogOut, Info, User, Bell, Building2, Settings, ChevronRight,
  Shield, HelpCircle, ExternalLink,
} from "lucide-react-native";
import { iconColor } from "../../theme/colors";

interface MenuItem {
  icon: typeof User;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}

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

  const accountItems: MenuItem[] = [
    {
      icon: User,
      label: "계정 정보",
      description: "이메일, 이름, 소속 확인",
      color: iconColor.primary,
      bgColor: "bg-blue-50",
      onPress: () => Alert.alert("계정 정보", "웹에서 계정 설정을 관리할 수 있습니다."),
    },
    {
      icon: Building2,
      label: "조직 관리",
      description: "소속 조직 확인 및 전환",
      color: iconColor.violet,
      bgColor: "bg-purple-50",
      onPress: () => Alert.alert("조직 관리", "웹에서 조직 설정을 관리할 수 있습니다."),
    },
  ];

  const settingsItems: MenuItem[] = [
    {
      icon: Bell,
      label: "알림 설정",
      description: "푸시 알림, 재고 알림 설정",
      color: iconColor.warning,
      bgColor: "bg-amber-50",
      onPress: () => Alert.alert("알림 설정", "알림 설정 기능은 준비 중입니다."),
    },
    {
      icon: Settings,
      label: "앱 설정",
      description: "테마, 캐시, 오프라인 모드",
      color: iconColor.secondary,
      bgColor: "bg-slate-100",
      onPress: () => Alert.alert("앱 설정", "앱 설정 기능은 준비 중입니다."),
    },
    {
      icon: Shield,
      label: "보안",
      description: "비밀번호 변경, 기기 관리",
      color: iconColor.success,
      bgColor: "bg-emerald-50",
      onPress: () => Alert.alert("보안", "웹에서 보안 설정을 관리할 수 있습니다."),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: HelpCircle,
      label: "도움말",
      description: "사용 가이드, FAQ",
      color: iconColor.sky,
      bgColor: "bg-sky-50",
      onPress: () => Alert.alert("도움말", "도움말 기능은 준비 중입니다."),
    },
    {
      icon: ExternalLink,
      label: "웹에서 열기",
      description: "PC 웹 대시보드로 이동",
      color: iconColor.secondary,
      bgColor: "bg-slate-100",
      onPress: () => Alert.alert("웹 대시보드", "웹 브라우저에서 전체 기능을 사용할 수 있습니다."),
    },
  ];

  const renderSection = (title: string, items: MenuItem[]) => (
    <View className="mx-4 mt-4">
      <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">
        {title}
      </Text>
      <View className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {items.map((item, idx) => (
          <Pressable
            key={item.label}
            className={`flex-row items-center p-4 ${
              idx < items.length - 1 ? "border-b border-slate-100" : ""
            }`}
            onPress={item.onPress}
          >
            <View className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${item.bgColor}`}>
              <item.icon size={18} color={item.color} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-slate-800">{item.label}</Text>
              <Text className="text-xs text-slate-400 mt-0.5">{item.description}</Text>
            </View>
            <ChevronRight size={16} color={iconColor.faint} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="px-5 pt-3 pb-3 bg-white border-b border-slate-100">
        <Text className="text-lg font-bold text-slate-900">설정</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {renderSection("계정", accountItems)}
        {renderSection("설정", settingsItems)}
        {renderSection("지원", supportItems)}

        {/* 로그아웃 */}
        <Pressable
          className="mx-4 mt-6 bg-white rounded-xl border border-red-200 flex-row items-center justify-center p-4"
          onPress={handleLogout}
        >
          <LogOut size={18} color={iconColor.danger} />
          <Text className="text-sm font-semibold text-red-600 ml-2">로그아웃</Text>
        </Pressable>

        {/* 앱 정보 */}
        <View className="items-center mt-6 mb-4">
          <View className="flex-row items-center gap-1.5">
            <Info size={14} color={iconColor.faint} />
            <Text className="text-xs text-slate-400">
              BioInsight Lab v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
