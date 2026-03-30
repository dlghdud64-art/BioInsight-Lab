import { View, Text, ActivityIndicator } from "react-native";

export function LoadingState({
  message,
}: {
  message?: string;
} = {}) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color="#2563eb" />
      {message && (
        <Text className="text-sm text-slate-400 mt-3">{message}</Text>
      )}
    </View>
  );
}
