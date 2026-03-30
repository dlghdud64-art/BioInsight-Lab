import { View, Text, Pressable } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { iconColor } from "../theme/colors";

export function ErrorState({
  title = "불러오기 실패",
  description = "잠시 후 다시 시도해주세요.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      <AlertTriangle size={48} color={iconColor.danger} />
      <Text className="text-base font-medium text-slate-700 mt-4">
        {title}
      </Text>
      <Text className="text-sm text-slate-400 mt-1 text-center">
        {description}
      </Text>
      {onRetry && (
        <Pressable
          className="mt-4 bg-blue-600 rounded-xl px-6 py-2.5"
          onPress={onRetry}
        >
          <Text className="text-sm font-semibold text-white">다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
}
