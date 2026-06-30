/**
 * §labaxis-mobile-reskin Phase 3 — 01 메인 대시보드(목업 재현). 출처: design_handoff README §01.
 *
 * 공통 셸(navy 헤더 + KPI 요약 스트립) + "지금 할 일" 카드 + 파이프라인(견적→입고→재고) +
 *   바로가기 + 지출 요약(실 구매 합계) + 최근 구매. 오프라인 sync·ScanHubSheet·3상태 보존.
 * ⚠️ 정직: DashboardSummary 실필드(pendingQuotes/lowStockItems/pendingInspections) + purchases 만.
 *   지출 "분석" 차트 데이터 없음 → 최근 구매 합계(실값)로 축소 표기(가짜 차트 금지).
 * ⚠️ AI 카드 금지(§AI-UI). "지금 할 일"=contextual next-step(서버 상태 파생, AI 아님).
 * 액션 wiring(no-op 0): 모든 CTA → 탭/디테일/스캔허브 실연결. §11.302 신호등 토큰.
 */
import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
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
  Clock,
  Search,
  Bell,
  Boxes,
  Wallet,
} from "lucide-react-native";
import { useDashboardSummary, usePurchases } from "../../hooks/useApi";
import { iconColor, spinnerColor } from "../../theme/colors";
import { getPendingCount, triggerSync } from "../../lib/offline";
import { ScanHubSheet } from "../../components/ScanHubSheet";
import { ScreenHeader } from "../../components/shell";
import type { HeaderAction, SummaryCell } from "../../components/shell";

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
  const [isSyncingPending, setIsSyncingPending] = useState(false);
  // §11.379 — 스캔 진입 허브(입고/사용 2분류). 보존.
  const [scanHubOpen, setScanHubOpen] = useState(false);

  const recentPurchases = (purchases ?? []).slice(0, 3);
  const purchaseTotal = (purchases ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);

  useEffect(() => {
    getPendingCount().then(setPendingSyncCount).catch(() => {});
  }, [summary]);

  const handleConfirmedSync = async () => {
    setIsSyncingPending(true);
    try {
      await triggerSync();
      setPendingSyncCount(await getPendingCount());
      refetch();
    } finally {
      setIsSyncingPending(false);
    }
  };

  // ── 3상태 판정(기존 보존) ──
  const pendingQuotes = summary?.pendingQuotes ?? 0;
  const lowStockItems = summary?.lowStockItems ?? 0;
  const pendingInspections = summary?.pendingInspections ?? 0;

  const processingRequired = lowStockItems + pendingInspections;
  const approvalPending = pendingQuotes;
  const inProgressCount = pendingQuotes;
  const hasFootprint = pendingQuotes > 0 || (purchases?.length ?? 0) > 0;
  const isBlocked = processingRequired > 0 || approvalPending > 0;
  const isZero = !isBlocked && inProgressCount === 0 && !hasFootprint;
  const dashboardState: "blocked" | "zero" | "active" = isBlocked
    ? "blocked"
    : isZero
      ? "zero"
      : "active";

  // ── KPI 요약 스트립(3, §11.311) ──
  const summaryCells: SummaryCell[] = [
    { value: String(processingRequired), label: "처리 필요", alert: processingRequired > 0 },
    { value: String(approvalPending), label: "승인 대기" },
    { value: String(inProgressCount), label: "진행 중" },
  ];

  // ── "지금 할 일": 최우선 1건(서버 상태 파생, AI 아님) ──
  const topTask =
    lowStockItems > 0
      ? { label: "재고 부족 확인", reason: `안전재고 미달 ${lowStockItems}건`, go: () => router.push("/(tabs)/inventory") }
      : pendingQuotes > 0
        ? { label: "견적 검토", reason: `승인 대기 ${pendingQuotes}건`, go: () => router.push("/(tabs)/quotes") }
        : pendingInspections > 0
          ? { label: "점검 기록", reason: `점검 필요 ${pendingInspections}건`, go: () => router.push("/(tabs)/inventory") }
          : null;

  // ── 바로가기(기존 wiring 보존) ──
  const quickActions =
    dashboardState === "zero"
      ? [
          { icon: Package, label: "품목 등록", color: iconColor.success, onPress: () => router.push("/(tabs)/inventory") },
          { icon: Search, label: "제품 검색", color: iconColor.primary, onPress: () => router.push("/(tabs)/inventory") },
          { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => setScanHubOpen(true) },
        ]
      : dashboardState === "blocked"
        ? [
            ...(lowStockItems > 0 ? [{ icon: AlertTriangle, label: "재고 부족 확인", color: iconColor.danger, onPress: () => router.push("/(tabs)/inventory") }] : []),
            ...(pendingQuotes > 0 ? [{ icon: FileText, label: "견적 검토", color: iconColor.warning, onPress: () => router.push("/(tabs)/quotes") }] : []),
            ...(pendingInspections > 0 ? [{ icon: ClipboardCheck, label: "점검 기록", color: iconColor.violet, onPress: () => router.push("/(tabs)/inventory") }] : []),
            { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => setScanHubOpen(true) },
          ]
        : [
            { icon: QrCode, label: "QR 스캔", color: iconColor.sky, onPress: () => setScanHubOpen(true) },
            { icon: ArrowDownToLine, label: "입고 처리", color: iconColor.success, onPress: () => router.push("/inventory/lot-receive" as any) },
            { icon: ArrowUpFromLine, label: "출고 처리", color: iconColor.violet, onPress: () => router.push("/inventory/lot-dispatch" as any) },
            { icon: ClipboardCheck, label: "점검 기록", color: iconColor.violet, onPress: () => router.push("/(tabs)/inventory") },
            { icon: ShoppingCart, label: "구매 등록", color: iconColor.primary, onPress: () => router.push("/purchases/register") },
          ];

  const actions: HeaderAction[] = [
    { icon: QrCode, onPress: () => setScanHubOpen(true), emphasized: true, accessibilityLabel: "QR 스캔" },
    { icon: Bell, onPress: () => router.push("/notifications"), badge: true, accessibilityLabel: "알림" },
  ];

  // 파이프라인 세그먼트(견적→입고→재고). 입고=스캔 허브 진입(QR 입고 핵심).
  const pipeline = [
    { label: "견적", count: pendingQuotes, icon: FileText, go: () => router.push("/(tabs)/quotes") },
    { label: "입고", count: null as number | null, icon: ArrowDownToLine, go: () => setScanHubOpen(true) },
    { label: "재고", count: lowStockItems, icon: Boxes, go: () => router.push("/(tabs)/inventory") },
  ];

  return (
    <View className="flex-1 bg-surface-bg">
      <ScreenHeader
        wordmark="LabAxis"
        title="대시보드"
        sub={
          dashboardState === "blocked"
            ? `확인이 필요한 항목 ${processingRequired + approvalPending}건`
            : dashboardState === "zero"
              ? "아래에서 첫 업무를 시작하세요"
              : "오늘 즉시 처리할 이슈가 없습니다"
        }
        actions={actions}
        summary={summaryCells}
      />

      {isLoading ? (
        <ActivityIndicator color={spinnerColor} className="py-12" />
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          {/* 오프라인 동기화 대기(보존, amber 토큰) */}
          {pendingSyncCount > 0 ? (
            <View className="gap-2.5 px-3.5 py-2.5 rounded-card bg-amber-weak border border-amber-line mb-4">
              <View className="flex-row items-center gap-2.5">
                <Clock size={16} color="#b45821" />
                <Text className="text-[12px] text-amber font-medium flex-1">
                  반영 대기 {pendingSyncCount}건 — 내용을 확인한 뒤 서버에 반영하세요
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="대기 작업 확인 후 동기화"
                disabled={isSyncingPending}
                onPress={handleConfirmedSync}
                className={`min-h-[44px] rounded-field items-center justify-center ${
                  isSyncingPending ? "bg-amber-line" : "bg-amber"
                }`}
              >
                <Text className="text-[12px] font-bold text-white">
                  {isSyncingPending ? "반영 중" : "확인 후 동기화"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* 지금 할 일(navy) 또는 정상 카드 */}
          {topTask ? (
            <Pressable
              onPress={topTask.go}
              accessibilityRole="button"
              accessibilityLabel={`지금 할 일: ${topTask.label}`}
              className="bg-navy-900 rounded-card px-4 py-3.5 mb-4"
            >
              <View className="flex-row items-center gap-1.5">
                <Clock size={13} color="#bfdbfe" />
                <Text className="text-[11px] font-bold text-accent-line">지금 할 일</Text>
              </View>
              <Text className="text-white text-[16px] font-extrabold mt-1.5">{topTask.label}</Text>
              <Text className="text-white/60 text-[12.5px] mt-0.5">{topTask.reason}</Text>
              <View className="flex-row mt-3">
                <View className="bg-white px-3.5 py-2 rounded-full flex-row items-center gap-1">
                  <Text className="text-navy-900 text-[13px] font-bold">바로 처리</Text>
                  <ChevronRight size={14} color="#0f172a" />
                </View>
              </View>
            </Pressable>
          ) : (
            <View className="bg-surface-paper border border-surface-line rounded-card p-4 mb-4 items-center">
              <View className="w-11 h-11 rounded-full bg-emerald-weak items-center justify-center mb-2">
                <CheckCircle2 size={22} color="#059669" />
              </View>
              <Text className="text-[14px] font-extrabold text-ink">운영 상태 정상</Text>
              <Text className="text-[12px] text-ink-3 mt-0.5 text-center">
                즉시 처리할 이슈가 없습니다. 아래 바로가기로 진행하세요.
              </Text>
            </View>
          )}

          {/* 파이프라인(견적→입고→재고) */}
          <View className="bg-surface-paper border border-surface-line rounded-card p-3 mb-4 flex-row items-center">
            {pipeline.map((seg, i) => (
              <View key={seg.label} className="flex-1 flex-row items-center">
                <Pressable
                  onPress={seg.go}
                  accessibilityRole="button"
                  accessibilityLabel={`${seg.label}로 이동`}
                  className="flex-1 items-center py-1"
                >
                  <seg.icon size={20} color="#2563eb" />
                  <Text className="text-[12px] font-bold text-ink mt-1">{seg.label}</Text>
                  {seg.count !== null ? (
                    <Text className={`text-[11px] mt-0.5 ${seg.count > 0 ? "text-rose-deep font-bold" : "text-ink-4"}`}>
                      {seg.count > 0 ? `${seg.count}건` : "—"}
                    </Text>
                  ) : (
                    <Text className="text-[11px] mt-0.5 text-ink-4">스캔</Text>
                  )}
                </Pressable>
                {i < pipeline.length - 1 ? (
                  <ChevronRight size={16} color="#cbd5e1" />
                ) : null}
              </View>
            ))}
          </View>

          {/* 바로가기 */}
          <Text className="text-[14px] font-bold text-ink mb-2.5">
            {dashboardState === "zero" ? "빠른 시작" : dashboardState === "blocked" ? "우선 처리" : "바로가기"}
          </Text>
          <View className="flex-row flex-wrap gap-2.5 mb-4">
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                className="w-[31%] bg-surface-paper border border-surface-line rounded-card p-3.5 items-center gap-2 min-h-[44px]"
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <action.icon size={20} color={action.color} />
                </View>
                <Text className="text-[11px] font-semibold text-ink-2 text-center">{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* 지출 요약(실 구매 합계 — 차트 데이터 없음, 합계만 정직 표기) */}
          {(purchases?.length ?? 0) > 0 ? (
            <Pressable
              onPress={() => router.push("/(tabs)/purchases")}
              accessibilityRole="button"
              accessibilityLabel="구매 내역 전체 보기"
              className="bg-surface-paper border border-surface-line rounded-card p-4 mb-4 flex-row items-center gap-3"
            >
              <View className="w-10 h-10 rounded-field bg-accent-weak items-center justify-center">
                <Wallet size={18} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] text-ink-3">최근 구매 합계</Text>
                <Text className="text-[18px] font-extrabold text-ink mt-0.5">
                  {formatAmount(purchaseTotal)}
                  <Text className="text-[12px] font-semibold text-ink-4"> · {purchases?.length}건</Text>
                </Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>
          ) : null}

          {/* 최근 구매(보존) */}
          {dashboardState !== "zero" && recentPurchases.length > 0 ? (
            <View>
              <View className="flex-row items-center justify-between mb-2.5">
                <Text className="text-[14px] font-bold text-ink">최근 구매</Text>
                <Pressable onPress={() => router.push("/(tabs)/purchases")}>
                  <Text className="text-[12px] text-accent font-semibold">전체 보기</Text>
                </Pressable>
              </View>
              <View className="bg-surface-paper border border-surface-line rounded-card overflow-hidden">
                {recentPurchases.map((p, idx) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/purchases/${p.id}` as any)}
                    className={`flex-row items-center justify-between p-3.5 ${
                      idx < recentPurchases.length - 1 ? "border-b border-surface-line-soft" : ""
                    }`}
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-[14px] font-medium text-ink" numberOfLines={1}>
                        {p.productName}
                      </Text>
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Calendar size={10} color="#94a3b8" />
                        <Text className="text-[10px] text-ink-4">{formatDate(p.purchasedAt)}</Text>
                      </View>
                    </View>
                    <Text className="text-[14px] font-bold text-accent-strong">{formatAmount(p.amount)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* §11.379 — 스캔 진입 허브(보존) */}
      <ScanHubSheet visible={scanHubOpen} onClose={() => setScanHubOpen(false)} />
    </View>
  );
}
