import { View, Text } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useNetworkStatus } from "../lib/useNetworkStatus";

export function OfflineBanner() {
  const isConnected = useNetworkStatus();

  if (isConnected) return null;

  return (
    <View className="bg-red-600 px-4 py-2 flex-row items-center justify-center gap-2">
      <WifiOff size={14} color="white" />
      <Text className="text-xs font-semibold text-white">
        네트워크 연결 없음
      </Text>
    </View>
  );
}
