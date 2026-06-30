/**
 * §labaxis-mobile-shell — 공통 navy 헤더 + 요약 스트립(4개 화면 공통).
 *   출처: design_handoff README "공통 셸 / 헤더 .phead / 요약 스트립 .sumstrip".
 *
 * - 상단 safe-area 까지 navy 연장(OS 상태바가 위에 그려짐). 하단만 라운드 22px.
 * - 우측 아이콘 액션은 onPress 필수(미지정 액션은 렌더 안 함 → dead button 0).
 * - 요약 스트립: 최대 3카드, alert=로즈 틴트. 값은 tabular-nums.
 * canonical 무관 · mutation 0(표시 전용 셸).
 */
import type { ComponentType } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface HeaderAction {
  /** lucide-react-native 아이콘 컴포넌트. */
  icon: ComponentType<{ size?: number; color?: string }>;
  onPress: () => void; // 필수 — no-op 금지.
  /** 빨간 점 배지(알림 등). */
  badge?: boolean;
  /** 스캔 등 강조(파랑 틴트). */
  emphasized?: boolean;
  accessibilityLabel: string;
}

export interface SummaryCell {
  value: string;
  unit?: string;
  label: string;
  /** 경고용(로즈 틴트). */
  alert?: boolean;
}

interface ScreenHeaderProps {
  wordmark: string;
  title: string;
  sub?: string;
  actions?: HeaderAction[];
  summary?: SummaryCell[];
}

export function ScreenHeader({
  wordmark,
  title,
  sub,
  actions = [],
  summary = [],
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="bg-navy-900 rounded-b-[22px] px-[18px] pb-[18px]"
      style={{ paddingTop: insets.top + 10 }}
    >
      {/* 상단 행: 워드마크 + 우측 액션 */}
      <View className="flex-row items-center justify-between">
        <Text className="text-white text-base font-extrabold tracking-tight">
          {wordmark}
        </Text>
        <View className="flex-row gap-2">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={i}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.accessibilityLabel}
                className={`w-9 h-9 rounded-[10px] items-center justify-center ${
                  a.emphasized ? "bg-[rgba(96,165,250,0.18)]" : "bg-white/[0.07]"
                }`}
              >
                <Icon size={20} color={a.emphasized ? "#bfdbfe" : "#ffffff"} />
                {a.badge ? (
                  <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 타이틀 */}
      <Text className="text-white text-[22px] font-extrabold tracking-tight mt-3">
        {title}
      </Text>
      {sub ? (
        <Text className="text-white/60 text-[12.5px] mt-0.5">{sub}</Text>
      ) : null}

      {/* 요약 스트립 */}
      {summary.length > 0 ? (
        <View className="flex-row gap-2 mt-3.5">
          {summary.slice(0, 3).map((c, i) => (
            <View
              key={i}
              className={`flex-1 rounded-[14px] px-3 py-2.5 ${
                c.alert ? "bg-rose/10" : "bg-white/[0.06]"
              }`}
            >
              <Text className="text-white text-2xl font-extrabold">
                {c.value}
                {c.unit ? (
                  <Text className="text-white/70 text-xs font-semibold">
                    {" "}
                    {c.unit}
                  </Text>
                ) : null}
              </Text>
              <Text
                className={`text-[11px] mt-0.5 ${
                  c.alert ? "text-rose-line" : "text-white/60"
                }`}
              >
                {c.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
