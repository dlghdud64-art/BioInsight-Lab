/**
 * §labaxis-mobile-shell — "더보기" 풀스크린 메뉴 시트(아래→위 슬라이드). 출처: README ".msheet".
 *
 * - RN Modal + Animated translateY(닫힘 100%→0) + 스크림 페이드.
 * - 탭바에 이미 있는 항목(견적·입고·재고)은 제외(중복 제거)는 호출부 groups 구성 책임.
 * - 각 항목 onPress 필수(no-op 금지). 로그아웃은 danger(로즈).
 * - 서버 truth 무관(네비/액션 트리거 셸). same-canvas: 오버레이(새 page 아님).
 */
import { useEffect, useRef } from "react";
import {
  Modal,
  Animated,
  View,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { ComponentType } from "react";

export interface MoreItem {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  onPress: () => void; // 필수.
  danger?: boolean;
}
export interface MoreGroup {
  title: string;
  items: MoreItem[];
}

interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
  workspace?: string;
  groups: MoreGroup[];
}

export function MoreSheet({
  visible,
  onClose,
  workspace,
  groups,
}: MoreSheetProps) {
  const insets = useSafeAreaInsets();
  const ty = useRef(new Animated.Value(1)).current; // 1 = 아래로 숨김
  const scrim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, {
        toValue: visible ? 0 : 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scrim, {
        toValue: visible ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, ty, scrim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={{ opacity: scrim }}
        className="absolute inset-0 bg-black/40"
      >
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="닫기" />
      </Animated.View>
      <Animated.View
        style={{
          transform: [
            {
              translateY: ty.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1000],
              }),
            },
          ],
        }}
        className="absolute inset-0 bg-surface-bg"
      >
        {/* navy 헤더 */}
        <View
          className="bg-navy-900 px-[18px] pb-4 flex-row items-center justify-between"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-white text-lg font-extrabold">메뉴</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="메뉴 닫기"
            className="w-9 h-9 rounded-[10px] items-center justify-center bg-white/[0.07]"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {workspace ? (
            <View className="bg-surface-paper rounded-card border border-surface-line px-4 py-3.5 mb-4">
              <Text className="text-[11px] text-ink-3 font-semibold">워크스페이스</Text>
              <Text className="text-[15.5px] text-ink font-extrabold mt-0.5">
                {workspace}
              </Text>
            </View>
          ) : null}

          {groups.map((g, gi) => (
            <View key={gi} className="mb-4">
              <Text className="text-[11px] text-ink-3 font-semibold px-1 mb-2">
                {g.title}
              </Text>
              <View className="bg-surface-paper rounded-card border border-surface-line overflow-hidden">
                {g.items.map((it, ii) => {
                  const Icon = it.icon;
                  return (
                    <Pressable
                      key={ii}
                      onPress={() => {
                        onClose();
                        it.onPress();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={it.label}
                      className={`flex-row items-center gap-3 px-4 min-h-[48px] ${
                        ii > 0 ? "border-t border-surface-line-soft" : ""
                      }`}
                    >
                      <Icon size={19} color={it.danger ? "#e11d48" : "#475569"} />
                      <Text
                        className={`text-[14px] font-semibold ${
                          it.danger ? "text-rose" : "text-ink"
                        }`}
                      >
                        {it.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
