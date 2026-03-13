import { View, Text } from "react-native";
import { Inbox } from "lucide-react-native";

export function EmptyState({
  title = "데이터가 없습니다",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center py-20 px-6">
      <Inbox size={48} color="#cbd5e1" />
      <Text className="text-base font-medium text-slate-500 mt-4">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-slate-400 mt-1 text-center">
          {description}
        </Text>
      )}
    </View>
  );
}
