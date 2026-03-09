import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText } from "lucide-react-native";

export default function QuotesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        <Text className="text-xl font-bold text-slate-900 mb-6">견적 관리</Text>
        <View className="flex-1 items-center justify-center py-20">
          <FileText size={48} color="#cbd5e1" />
          <Text className="text-slate-400 text-base mt-4">견적 기능은 준비 중입니다</Text>
          <Text className="text-slate-400 text-sm mt-1">PC 웹에서 이용해 주세요</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
