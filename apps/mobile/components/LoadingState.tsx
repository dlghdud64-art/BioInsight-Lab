import { View, Text, ActivityIndicator } from "react-native";
import { spinnerColor } from "../theme/colors";

export function LoadingState({
  message,
}: {
  message?: string;
} = {}) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <ActivityIndicator size="large" color={spinnerColor} />
      {message && (
        <Text className="text-sm text-slate-400 mt-3">{message}</Text>
      )}
    </View>
  );
}
