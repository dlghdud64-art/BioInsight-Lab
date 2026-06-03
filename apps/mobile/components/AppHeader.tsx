import { View, Text } from "react-native";
import type { ReactNode } from "react";

/**
 * §11.358-3 — 공통 모바일 헤더(정합). 탭별 인라인 헤더 문법 불일치 해소.
 *
 * 통일 규격:
 *  - 컨테이너: px-5 pt-3 pb-3 bg-white border-b border-slate-100
 *  - 제목: text-lg font-bold text-slate-900 (이전 index 의 font-extrabold/pb-2 정합)
 *  - 서브타이틀(선택): text-xs text-slate-500 mt-0.5
 *  - 우측 액션(선택): flex-shrink-0 (예: 구매 "등록" 버튼)
 * page-per-feature 회귀 방지 — 모든 탭이 동일 헤더 컴포넌트 사용.
 */
export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-start justify-between px-5 pt-3 pb-3 bg-white border-b border-slate-100">
      <View className="flex-1 min-w-0">
        <Text className="text-lg font-bold text-slate-900" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-shrink-0 ml-2">{right}</View> : null}
    </View>
  );
}
