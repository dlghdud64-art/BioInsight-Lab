import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, FileText, BarChart2 } from "lucide-react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
        {/* 헤더 */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-blue-900">BioInsight Lab</Text>
          <Text className="text-sm text-slate-500 mt-1">연구실 구매 플랫폼</Text>
        </View>

        {/* 빠른 실행 */}
        <Text className="text-base font-semibold text-slate-700 mb-3">빠른 실행</Text>
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            className="flex-1 bg-blue-600 rounded-2xl p-4 items-center"
            onPress={() => router.push("/(tabs)/search")}
          >
            <Search size={24} color="white" />
            <Text className="text-white font-semibold mt-2 text-sm">제품 검색</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-white rounded-2xl p-4 items-center border border-slate-200"
            onPress={() => router.push("/(tabs)/quotes")}
          >
            <FileText size={24} color="#2563eb" />
            <Text className="text-blue-600 font-semibold mt-2 text-sm">견적 관리</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-white rounded-2xl p-4 items-center border border-slate-200"
          >
            <BarChart2 size={24} color="#10b981" />
            <Text className="text-emerald-600 font-semibold mt-2 text-sm">분석</Text>
          </TouchableOpacity>
        </View>

        {/* 안내 */}
        <View className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <Text className="text-sm font-semibold text-blue-800 mb-1">💡 시작하기</Text>
          <Text className="text-sm text-blue-700 leading-relaxed">
            제품 검색에서 시약명, CAS Number, 제조사를 검색해보세요.{"\n"}
            전 세계 500만 개의 시약·장비를 비교할 수 있습니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
