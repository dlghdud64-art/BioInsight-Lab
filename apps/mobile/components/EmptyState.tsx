import { View, Text, Pressable } from "react-native";
import { Inbox } from "lucide-react-native";
import { iconColor } from "../theme/colors";

// §11.361-2 — 선택적 액션(예: "필터 초기화"). 필터 결과 0건을 전역 빈상태로
// 위장하지 않고, 필터 해제 CTA 를 제공하기 위해 추가. ErrorState.onRetry 패턴과 동일.
export function EmptyState({
  title = "데이터가 없습니다",
  description,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      <Inbox size={48} color={iconColor.faint} />
      <Text className="text-base font-medium text-slate-500 mt-4">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-slate-400 mt-1 text-center">
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          className="mt-4 bg-slate-100 rounded-xl px-5 py-2.5"
          onPress={onAction}
        >
          <Text className="text-sm font-semibold text-slate-700">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
