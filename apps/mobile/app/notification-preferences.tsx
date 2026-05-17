/**
 * §11.250-pref-mobile #mobile-notification-preference-toggles — Expo settings 7 카테고리 토글.
 *
 * 호영님 spec: §11.250-pref-ui (web settings 토글) 의 mobile platform 동기.
 *   Expo 앱 안 동일 7 카테고리 Switch UI. web `/api/user/preferences` endpoint
 *   reuse (별도 mobile route 신설 0). 사용자가 mobile/web 어느 surface 에서든
 *   토글 → server preference 즉시 sync → cross-platform 1:1 정합.
 *
 * canonical truth lock:
 *   - User.preferences.notificationToggles Json field (schema 0).
 *   - 7 카테고리 (event-category-map) — web + mobile 1:1.
 *   - default true 보존 — 명시 false 만 OFF 표시.
 *   - §11.250-pref backend filter + §11.250-pref-push push filter 와 즉시 정합.
 */

import { View, Text, Pressable, Switch, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { iconColor } from "../theme/colors";
import {
  useUserPreferences,
  useUpdateNotificationToggles,
  type NotificationTogglesPatch,
} from "../hooks/useApi";

type CategoryKey = keyof NotificationTogglesPatch;

interface CategoryDescriptor {
  key: CategoryKey;
  label: string;
  description: string;
}

// §11.250-pref-mobile — 7 카테고리 한국어 라벨 (web §11.250-pref-ui 와 동일).
const CATEGORIES: CategoryDescriptor[] = [
  {
    key: "stock_alert",
    label: "재고 부족 알림",
    description: "안전 재고 수량 이하로 떨어진 품목 알림",
  },
  {
    key: "quote_arrived",
    label: "견적 수신 알림",
    description: "공급사 견적 회신 도착 알림",
  },
  {
    key: "approval_pending",
    label: "승인 대기 알림",
    description: "구매 요청 / 견적 / 발주 승인 대기 알림",
  },
  {
    key: "expiry_warning",
    label: "유효기간 임박 알림",
    description: "재고 유효기간 / 견적 만료 임박 알림",
  },
  {
    key: "safety_alert",
    label: "안전 알림",
    description: "MSDS 미등록 등 안전 관련 알림 (항상 권장)",
  },
  {
    key: "delivery_complete",
    label: "배송 / 입고 완료 알림",
    description: "주문 배송 완료 및 입고 처리 알림",
  },
  {
    key: "system",
    label: "시스템 알림",
    description: "예산 경고 / PDF 분석 실패 등 시스템 알림",
  },
];

export default function NotificationPreferencesScreen() {
  const { data, isLoading, isError } = useUserPreferences();
  const updateMutation = useUpdateNotificationToggles();

  const toggles = data?.preferences?.notificationToggles ?? {};

  // §11.250-pref-mobile — default true 보존: 명시 false 만 OFF 표시.
  const isChecked = (key: CategoryKey): boolean => {
    const value = toggles[key];
    return value !== false;
  };

  const handleToggle = (key: CategoryKey, next: boolean) => {
    updateMutation.mutate({ [key]: next });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
        <Pressable
          onPress={() => router.back()}
          className="mr-2 p-1"
          hitSlop={8}
        >
          <ChevronLeft size={22} color={iconColor.secondary} />
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">알림 설정</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* 안내 카드 */}
        <View className="mx-4 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <Text className="text-sm font-medium text-blue-900 mb-1">
            알림 카테고리 설정
          </Text>
          <Text className="text-xs text-blue-700 leading-5">
            기본값은 모두 ON 이며, 변경 사항은 자동 저장되어 모든 기기 (모바일·
            웹) 에 즉시 반영됩니다. OFF 로 변경 시 해당 카테고리의 인앱 / 푸시
            알림이 도착하지 않습니다.
          </Text>
        </View>

        {/* 로딩 상태 */}
        {isLoading && (
          <View className="mt-8 items-center">
            <ActivityIndicator size="small" color={iconColor.primary} />
            <Text className="text-xs text-slate-400 mt-2">불러오는 중...</Text>
          </View>
        )}

        {/* 에러 상태 */}
        {isError && (
          <View className="mx-4 mt-4 p-4 bg-rose-50 rounded-xl border border-rose-200">
            <Text className="text-sm font-medium text-rose-700">
              설정을 불러오지 못했습니다.
            </Text>
            <Text className="text-xs text-rose-600 mt-1">
              네트워크 상태를 확인하고 화면을 다시 열어 주세요.
            </Text>
          </View>
        )}

        {/* 7 카테고리 Switch 리스트 */}
        {!isLoading && !isError && (
          <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {CATEGORIES.map((cat, idx) => (
              <View
                key={cat.key}
                className={`flex-row items-center p-4 ${
                  idx < CATEGORIES.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-slate-800">
                    {cat.label}
                  </Text>
                  <Text className="text-xs text-slate-500 mt-1 leading-4">
                    {cat.description}
                  </Text>
                </View>
                <Switch
                  value={isChecked(cat.key)}
                  onValueChange={(next: boolean) =>
                    handleToggle(cat.key, next)
                  }
                  disabled={updateMutation.isPending}
                  trackColor={{ false: "#cbd5e1", true: "#3b82f6" }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>
        )}

        {/* 저장 상태 표시 */}
        {updateMutation.isPending && (
          <View className="mx-4 mt-3 flex-row items-center justify-center">
            <ActivityIndicator size="small" color={iconColor.primary} />
            <Text className="text-xs text-slate-400 ml-2">저장 중...</Text>
          </View>
        )}
        {updateMutation.isError && (
          <View className="mx-4 mt-3">
            <Text className="text-xs text-rose-600 text-center">
              저장 실패 — 다시 시도해 주세요.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
