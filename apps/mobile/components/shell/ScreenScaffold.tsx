/**
 * §labaxis-mobile-shell — 화면 스캐폴드: navy 헤더 + 스크롤 본문(스크롤바 숨김).
 *   출처: README "공통 셸 / .screen 3단(상태바·body·탭바)". 탭바는 expo-router Tabs(네이티브)가 소유.
 *
 * - 본문 배경 surface-bg, 스크롤바 숨김.
 * - 헤더는 ScreenHeader(자체 safe-area). 하단 탭바 영역은 contentInset 으로 가림 방지.
 * - 상태(loading/error/empty)는 화면별로 children 에 둠(셸은 레이아웃만).
 */
import type { ReactNode } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "./ScreenHeader";
import type { HeaderAction, SummaryCell } from "./ScreenHeader";

interface ScreenScaffoldProps {
  wordmark: string;
  title: string;
  sub?: string;
  actions?: HeaderAction[];
  summary?: SummaryCell[];
  /** 헤더 바로 아래 고정 영역(필터 칩 등, 스크롤 안 됨). */
  stickyBelowHeader?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ScreenScaffold({
  wordmark,
  title,
  sub,
  actions,
  summary,
  stickyBelowHeader,
  children,
  refreshing,
  onRefresh,
}: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-bg">
      <ScreenHeader
        wordmark={wordmark}
        title={title}
        sub={sub}
        actions={actions}
        summary={summary}
      />
      {stickyBelowHeader ? <View className="pt-3">{stickyBelowHeader}</View> : null}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 80,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}
