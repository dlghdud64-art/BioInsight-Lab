/**
 * §11.250g-2 #mobile-compare-detail-surface — AI 비교 분석 결과 detail screen.
 *
 * 호영님 spec: §11.250g push notification ("AI 비교 분석 완료") tap 시 본 screen
 *   진입. 핵심 변화 + 권장 조치 + 비교 대상 제품 + 결정 상태 표시.
 *
 * canonical truth lock:
 *   - CompareSession.aiInsight Json (keyChanges + recommendedActions) source.
 *   - GET /api/compare-sessions/[id] route reuse (server schema 0).
 *   - dead-button 0 (Tab anchor 없음 — push tap deep-link only).
 */

import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Sparkles, CheckCircle2, AlertCircle } from "lucide-react-native";
import { iconColor } from "../../theme/colors";
import { useCompareSession } from "../../hooks/useApi";

export default function CompareDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, isError } = useCompareSession(id);

  const session = data?.session;
  const insight = session?.aiInsight ?? null;
  const keyChanges = insight?.keyChanges ?? [];
  const recommendedActions = insight?.recommendedActions ?? [];
  const productIds = session?.productIds ?? [];
  const createdAt = session?.createdAt;
  const linkedQuoteCount = data?.linkedQuotes?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      {/* 헤더 */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
        <Pressable
          onPress={() => router.back()}
          className="mr-2 p-1"
          hitSlop={8}
        >
          <ChevronLeft size={22} color={iconColor.secondary} />
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">AI 비교 분석 결과</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* 로딩 */}
        {isLoading && (
          <View className="mt-8 items-center">
            <ActivityIndicator size="small" color={iconColor.primary} />
            <Text className="text-xs text-slate-400 mt-2">불러오는 중...</Text>
          </View>
        )}

        {/* 에러 */}
        {isError && (
          <View className="mx-4 mt-4 p-4 bg-rose-50 rounded-xl border border-rose-200">
            <Text className="text-sm font-medium text-rose-700">
              비교 결과를 불러오지 못했습니다.
            </Text>
            <Text className="text-xs text-rose-600 mt-1">
              네트워크 상태를 확인하고 화면을 다시 열어 주세요.
            </Text>
          </View>
        )}

        {/* 메타 카드 (제품 + 시각 + 연결 견적) */}
        {!isLoading && !isError && session && (
          <>
            <View className="mx-4 mt-4 p-4 bg-white rounded-xl border border-slate-200">
              <View className="flex-row items-center mb-2">
                <Sparkles size={16} color={iconColor.primary} />
                <Text className="ml-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  비교 세션
                </Text>
              </View>
              <Text className="text-sm text-slate-700">
                비교 대상 제품 {productIds.length}건
              </Text>
              {createdAt && (
                <Text className="text-xs text-slate-400 mt-1">
                  생성: {new Date(createdAt).toLocaleString("ko-KR")}
                </Text>
              )}
              {linkedQuoteCount > 0 && (
                <Text className="text-xs text-slate-500 mt-1">
                  연결된 견적 {linkedQuoteCount}건
                </Text>
              )}
            </View>

            {/* aiInsight 없음 */}
            {!insight && (
              <View className="mx-4 mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <Text className="text-sm font-medium text-amber-800">
                  아직 AI 분석 결과가 없습니다.
                </Text>
                <Text className="text-xs text-amber-700 mt-1">
                  웹 대시보드에서 AI 분석을 실행한 뒤 다시 확인해 주세요.
                </Text>
              </View>
            )}

            {/* 핵심 변화 */}
            {insight && keyChanges.length > 0 && (
              <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                <View className="flex-row items-center p-4 border-b border-slate-100">
                  <AlertCircle size={16} color={iconColor.warning} />
                  <Text className="ml-2 text-sm font-bold text-slate-900">
                    핵심 변화 ({keyChanges.length}건)
                  </Text>
                </View>
                <View className="p-4">
                  {keyChanges.map((change, idx) => (
                    <View
                      key={idx}
                      className={`flex-row ${
                        idx < keyChanges.length - 1 ? "mb-3" : ""
                      }`}
                    >
                      <Text className="text-xs text-slate-400 mr-2 mt-0.5">
                        {idx + 1}.
                      </Text>
                      <Text className="flex-1 text-sm text-slate-700 leading-5">
                        {change}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 권장 조치 */}
            {insight && recommendedActions.length > 0 && (
              <View className="mx-4 mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
                <View className="flex-row items-center p-4 border-b border-slate-100">
                  <CheckCircle2 size={16} color={iconColor.success} />
                  <Text className="ml-2 text-sm font-bold text-slate-900">
                    권장 조치 ({recommendedActions.length}건)
                  </Text>
                </View>
                <View className="p-4">
                  {recommendedActions.map((action, idx) => (
                    <View
                      key={idx}
                      className={`flex-row ${
                        idx < recommendedActions.length - 1 ? "mb-3" : ""
                      }`}
                    >
                      <Text className="text-xs text-slate-400 mr-2 mt-0.5">
                        {idx + 1}.
                      </Text>
                      <Text className="flex-1 text-sm text-slate-700 leading-5">
                        {action}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 안내 */}
            <View className="mx-4 mt-4 p-3 bg-blue-50 rounded-xl">
              <Text className="text-xs text-blue-700 leading-5">
                상세 비교 표 · 결정 기록 · 견적 발송은 웹 대시보드에서 진행해
                주세요.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
