import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ShoppingCart,
  Package,
  FileText,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  ChevronRight,
  Calendar,
  QrCode,
  ClipboardCheck,
  CheckCircle2,
  Shield,
  Clock,
  Plus,
  Search,
} from "lucide-react-native";
import { useDashboardSummary, usePurchases } from "../../hooks/useApi";
import { iconColor, spinnerColor } from "../../theme/colors";
import { getPendingCount } from "../../lib/offline";

import { useState, useEffect } from "react";

/**
 * 모바일 홈 — 3상태 대시보드
 *
 * 웹과 동일한 zero/active/blocked 판정.
 * 차트/분석/복잡한 rail은 없음 — KPI 4개 + 상태 카드 + quick actions만.
 * 모바일은 운영 edge tool: 스캔/점검/입고/확인 중심.
 */

function formatAmount(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { data: summary, isLoading, refetch, isRefetching } = useDashboardSummary();
  const { data: purchases } = usePurchases();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const recentPurchases = (purchases ?? []).slice(0, 3);

  // 오프라인 pending mutation 개수
  useEffect(() => {
    getPendingCount().then(setPendingSyncCount).catch(() => {});
  }, [summary]);

  // ── 3상태 판정 ──
  const pendingQuotes = summary?.pendingQuotes ?? 0;
  const lowStockItems = summary?.lowStockItems ?? 0;
  const pendingInspections = summary?.pendingInspections ?? 0;

  const processingRequired = lowStockItems + pendingInspections;
  const approvalPending = pendingQuotes;
  const riskOrBlocker = 0; // TODO: 서버에서 SLA breach count 추가 시 연동
  const inProgressCount = pendingQuotes;
  const hasFootprint = (summary?.pendingQuotes ?? 0) > 0 || (purchases?.length ?? 0) > 0;

  const isBlocked = processingRequired > 0 || approvalPending > 0 || riskOrBlocker > 0;
  const isZero = !isBlocked && inProgressCount === 0 && !hasFootprint;
  const dashboardState: "blocked" | "zero" | "active" = isBlocked
    ? "blocked"
    : isZero
      ? "zero"
      : "active";

  // ── KPI 4개 ──
  const kpis = [
    {
      label: "처리 필요",
      value: processingRequired,
      color: processingRequired > 0 ? iconColor.warning : iconColor.muted,
      bgColor: processingRequired > 0 ? "bg-amber-50" : "bg-slate-50",
      hint: dashboardState === "zero" ? "생성된 업무 없음" : processingRequired > 0 ? "즉시 확인 필요" : "처리할 항목 없음",
    },
    {
      label: "승인 대기",
      value: approvalPending,
      color: approvalPending > 0 ? iconColor.primary : iconColor.muted,
      bgColor: approvalPending > 0 ? "bg-blue-50" : "bg-slate-50",
      hint: approvalPending > 0 ? "검토 대기 중" : "대기 없음",
    },
    {
      label: "진행 중",
      value: inProgressCount,
      color: inProgressCount > 0 ? iconColor.success : iconColor.muted,
      bgColor: inProgressCount > 0 ? "bg-emerald-50" : "bg-slate-50",
      hint: inProgressCount > 0 ? "진행 중 작업" : "진행 없음",
    },
    {
      label: "위험/차단",
      value: riskOrBlocker,
      color: riskOrBlocker > 0 ? iconColor.danger : iconColor.muted,
      bgColor: riskOrBlocker > 0 ? "bg-red-50" : "bg-slate-50",
      hint: riskOrBlocker > 0 ? "검토 필요" : "이상 없음",
    },
  ];

  // ── 바로가기 (모바일 edge tool 중심) ──
  const quickActions = dashboardState === "zero"
    ? [
        { icon: Package, label: "품목 등록", color: iconColor.success, onPress: () => router.push("/(tabs)/inventory") },
        { icon: Search, label: "제품 검색", color: iconColor.primary, onPress: () => router.push("/(tabs)/inventory") },
        { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => router.push("/scan") },
      ]
    : dashboardState === "blocked"
      ? [
          ...(lowStockItems > 0 ? [{ icon: AlertTriangle, label: "재고 부족 확인", color: iconColor.danger, onPress: () => router.push("/(tabs)/inventory") }] : []),
          ...(pendingQuotes > 0 ? [{ icon: FileText, label: "견적 검토", color: iconColor.warning, onPress: () => router.push("/(tabs)/quotes") }] : []),
          ...(pendingInspections > 0 ? [{ icon: ClipboardCheck, label: "점검 기록", color: iconColor.violet, onPress: () => router.push("/(tabs)/inventory") }] : []),
          { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => router.push("/scan") },
        ]
      : [
          { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => router.push("/scan") },
          { icon: ArrowDownToLine, label: "입고 처리", color: iconColor.success, onPress: () => router.push("/inventory/lot-receive" as any) },
          { icon: ArrowUpFromLine, label: "출고 처리", color: iconColor.violet, onPress: () => router.push("/inventory/lot-dispatch" as any) },
          { icon: ClipboardCheck, label: "점검 기록", color: iconColor.violet, onPress: () => router.push("/(tabs)/inventory") },
          { icon: ShoppingCart, label: "구매 등록", color: iconColor.primary, onPress: () => router.push("/purchases/register") },
        ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* ── 헤더 ── */}
        <View className="px-5 pt-3 pb-2 bg-white border-b border-slate-100">
          <Text className="text-lg font-extrabold text-slate-900 tracking-tight">
            LabAxis
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {dashboardState === "blocked"
              ? `확인이 필요한 항목 ${processingRequired + approvalPending}건`
              : dashboardState === "zero"
                ? "아래에서 첫 업무를 시작하세요"
                : "오늘 즉시 처리할 이슈가 없습니다"}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={spinnerColor} className="py-12" />
        ) : (
          <View className="px-4 pt-4 pb-8 gap-4">

            {/* ── KPI 4개 ── */}
            <View className="flex-row gap-2">
              {kpis.map((kpi) => (
                <View key={kpi.label} className={`flex-1 rounded-xl p-3 ${kpi.bgColor}`}>
                  <Text className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{kpi.label}</Text>
                  <Text className="text-xl font-extrabold mt-0.5" style={{ color: kpi.color }}>{kpi.value}</Text>
                  <Text className="text-[10px] text-slate-400 mt-0.5">{kpi.hint}</Text>
                </View>
              ))}
            </View>

            {/* ── 오프라인 동기화 대기 배너 ── */}
            {pendingSyncCount > 0 && (
              <View className="flex-row items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <Clock size={16} color={iconColor.warning} />
                <Text className="text-xs text-amber-700 font-medium flex-1">
                  동기화 대기 중 {pendingSyncCount}건 — 네트워크 연결 시 자동 전송됩니다
                </Text>
              </View>
            )}

            {/* ── 상태 카드 ── */}
            <View className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              {dashboardState === "zero" && (
                <View className="p-5 items-center">
                  <View className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center mb-3">
                    <Package size={24} color={iconColor.muted} />
                  </View>
                  <Text className="text-sm font-semibold text-slate-700 mb-1">아직 운영 데이터가 없습니다</Text>
                  <Text className="text-xs text-slate-400 text-center leading-relaxed">
                    품목을 등록하거나 QR 스캔으로{"\n"}첫 운영 흐름을 시작하세요
                  </Text>
                </View>
              )}

              {dashboardState === "active" && (
                <View className="p-5 items-center">
                  <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mb-3">
                    <CheckCircle2 size={24} color={iconColor.success} />
                  </View>
                  <Text className="text-sm font-semibold text-slate-700 mb-1">운영 상태 정상</Text>
                  <Text className="text-xs text-slate-400 text-center leading-relaxed">
                    즉시 처리할 이슈가 없습니다.{"\n"}아래 바로가기로 업무를 진행하세요.
                  </Text>
                </View>
              )}

              {dashboardState === "blocked" && (
                <View className="p-4 gap-2">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="w-2 h-2 rounded-full bg-amber-500" />
                    <Text className="text-sm font-semibold text-slate-900">확인이 필요한 항목</Text>
                  </View>
                  {lowStockItems > 0 && (
                    <Pressable
                      className="flex-row items-center justify-between px-3 py-2.5 rounded-lg bg-red-50"
                      onPress={() => router.push("/(tabs)/inventory")}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <AlertTriangle size={16} color={iconColor.danger} />
                        <Text className="text-sm font-medium text-red-800">재고 부족</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Text className="text-sm font-bold text-red-700">{lowStockItems}건</Text>
                        <ChevronRight size={14} color={iconColor.danger} />
                      </View>
                    </Pressable>
                  )}
                  {pendingQuotes > 0 && (
                    <Pressable
                      className="flex-row items-center justify-between px-3 py-2.5 rounded-lg bg-blue-50"
                      onPress={() => router.push("/(tabs)/quotes")}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <FileText size={16} color={iconColor.primary} />
                        <Text className="text-sm font-medium text-blue-800">승인 대기 견적</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Text className="text-sm font-bold text-blue-700">{pendingQuotes}건</Text>
                        <ChevronRight size={14} color={iconColor.primary} />
                      </View>
                    </Pressable>
                  )}
                  {pendingInspections > 0 && (
                    <Pressable
                      className="flex-row items-center justify-between px-3 py-2.5 rounded-lg bg-purple-50"
                      onPress={() => router.push("/(tabs)/inventory")}
                    >
                      <View className="flex-row items-center gap-2.5">
                        <ClipboardCheck size={16} color={iconColor.violet} />
                        <Text className="text-sm font-medium text-purple-800">점검 필요</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Text className="text-sm font-bold text-purple-700">{pendingInspections}건</Text>
                        <ChevronRight size={14} color={iconColor.violet} />
                      </View>
                    </Pressable>
                  )}
                </View>
              )}
            </View>

            {/* ── 바로가기 ── */}
            <View>
              <Text className="text-sm font-bold text-slate-800 mb-2.5">
                {dashboardState === "zero" ? "빠른 시작" : dashboardState === "blocked" ? "우선 처리" : "바로가기"}
              </Text>
              <View className="flex-row flex-wrap gap-2.5">
                {quickActions.map((action) => (
                  <Pressable
                    key={action.label}
                    className="w-[31%] bg-white border border-slate-200 rounded-xl p-3.5 items-center gap-2"
                    onPress={action.onPress}
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon size={20} color={action.color} />
                    </View>
                    <Text className="text-[11px] font-semibold text-slate-700 text-center">{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── 최근 구매 내역 (active/blocked만) ── */}
            {dashboardState !== "zero" && recentPurchases.length > 0 && (
              <View>
                <View className="flex-row items-center justify-between mb-2.5">
                  <Text className="text-sm font-bold text-slate-800">최근 구매</Text>
                  <Pressable onPress={() => router.push("/(tabs)/purchases")}>
                    <Text className="text-xs text-blue-600 font-medium">전체 보기</Text>
                  </Pressable>
                </View>
                <View className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {recentPurchases.map((p, idx) => (
                    <Pressable
                      key={p.id}
                      className={`flex-row items-center justify-between p-3.5 ${
                        idx < recentPurchases.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                      onPress={() => router.push(`/purchases/${p.id}` as any)}
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-sm font-medium text-slate-800" numberOfLines={1}>
                          {p.productName}
                        </Text>
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <Calendar size={10} color={iconColor.muted} />
                          <Text className="text-[10px] text-slate-400">{formatDate(p.purchasedAt)}</Text>
                        </View>
                      </View>
                      <Text className="text-sm font-bold text-blue-600">{formatAmount(p.amount)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
