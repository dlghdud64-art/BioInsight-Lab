/**
 * §labaxis-mobile-reskin Phase 4 — 04 입고 화면. 출처: design_handoff README §04(재해석).
 *
 * ⚠️ 정직: receiving/문서게이트 큐 API 부재(목업 CASES=데모). 가짜 데이터 금지(no-op/fake) →
 *   목업의 "문서 게이트 큐"는 백엔드(receiving API) 신설 후속. 본 화면은 **실기능 입고 허브**:
 *   QR 스캔 입고 · 직접 입고 처리 · 최근 입고/구매(실데이터) · 오프라인 반영 대기(현장 핵심).
 * 액션 wiring(no-op 0): 스캔 → /scan(intent receive_label), 직접입고 → /inventory/lot-receive,
 *   최근건 → /purchases/[id], 알림 → /notifications. §6 오프라인 sync 보존.
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
  ScanLine,
  ArrowDownToLine,
  ChevronRight,
  Calendar,
  Clock,
  Bell,
  PackageCheck,
} from "lucide-react-native";
import { usePurchases } from "../../hooks/useApi";
import { getPendingCount, triggerSync } from "../../lib/offline";
import { spinnerColor } from "../../theme/colors";
import { ScreenHeader } from "../../components/shell";
import type { HeaderAction, SummaryCell } from "../../components/shell";

function formatAmount(n: number) {
  return `₩${n.toLocaleString("ko-KR")}`;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function isThisMonth(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function InboundScreen() {
  const { data: purchases, isLoading, refetch, isRefetching } = usePurchases();
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  useEffect(() => {
    getPendingCount().then(setPendingSyncCount).catch(() => {});
  }, [purchases]);

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

  const all = purchases ?? [];
  const recent = all.slice(0, 6);
  const thisMonthCount = all.filter((p) => isThisMonth(p.purchasedAt)).length;

  const summary: SummaryCell[] = [
    { value: String(pendingSyncCount), label: "반영 대기", alert: pendingSyncCount > 0 },
    { value: String(thisMonthCount), unit: "건", label: "이번 달 입고" },
    { value: String(all.length), unit: "건", label: "최근 구매" },
  ];

  const actions: HeaderAction[] = [
    {
      icon: ScanLine,
      onPress: () => router.push({ pathname: "/scan", params: { intent: "receive_label" } }),
      emphasized: true,
      accessibilityLabel: "QR 스캔 입고",
    },
    {
      icon: Bell,
      onPress: () => router.push("/notifications"),
      badge: true,
      accessibilityLabel: "알림",
    },
  ];

  return (
    <View className="flex-1 bg-surface-bg">
      <ScreenHeader
        wordmark="LabAxis"
        title="입고 관리"
        sub="라벨 스캔으로 빠르게 입고하세요"
        actions={actions}
        summary={summary}
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
          {/* 오프라인 반영 대기(현장 핵심) */}
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

          {/* 주 입고 경로: QR 스캔 입고(primary) */}
          <Pressable
            onPress={() => router.push({ pathname: "/scan", params: { intent: "receive_label" } })}
            accessibilityRole="button"
            accessibilityLabel="QR/라벨 스캔으로 입고"
            className="bg-navy-900 rounded-card px-4 py-4 mb-3 flex-row items-center gap-3"
          >
            <View className="w-11 h-11 rounded-field bg-[rgba(96,165,250,0.18)] items-center justify-center">
              <ScanLine size={22} color="#bfdbfe" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-[16px] font-extrabold">라벨 스캔으로 입고</Text>
              <Text className="text-white/60 text-[12.5px] mt-0.5">
                제품명·Lot·유효기간 자동 추출 · 검수/격리 포함
              </Text>
            </View>
            <ChevronRight size={18} color="#bfdbfe" />
          </Pressable>

          {/* 보조: 직접 입고 처리 */}
          <Pressable
            onPress={() => router.push("/inventory/lot-receive" as any)}
            accessibilityRole="button"
            accessibilityLabel="직접 입고 처리"
            className="bg-surface-paper border border-surface-line rounded-card px-4 py-3.5 mb-4 flex-row items-center gap-3"
          >
            <View className="w-10 h-10 rounded-field bg-emerald-weak items-center justify-center">
              <ArrowDownToLine size={18} color="#059669" />
            </View>
            <View className="flex-1">
              <Text className="text-ink text-[14px] font-bold">직접 입고 처리</Text>
              <Text className="text-ink-3 text-[12px] mt-0.5">스캔 없이 수기 입고 등록</Text>
            </View>
            <ChevronRight size={16} color="#94a3b8" />
          </Pressable>

          {/* 최근 입고/구매(실데이터) */}
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-[14px] font-bold text-ink">최근 입고·구매</Text>
            {all.length > recent.length ? (
              <Pressable onPress={() => router.push("/(tabs)/inventory")}>
                <Text className="text-[12px] text-accent font-semibold">재고 보기</Text>
              </Pressable>
            ) : null}
          </View>

          {recent.length > 0 ? (
            <View className="bg-surface-paper border border-surface-line rounded-card overflow-hidden">
              {recent.map((p, idx) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/purchases/${p.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.productName} 상세`}
                  className={`flex-row items-center justify-between p-3.5 ${
                    idx < recent.length - 1 ? "border-b border-surface-line-soft" : ""
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
                  <Text className="text-[14px] font-bold text-accent-strong">
                    {formatAmount(p.amount)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="bg-surface-paper border border-surface-line rounded-card p-6 items-center">
              <View className="w-11 h-11 rounded-full bg-surface-line-soft items-center justify-center mb-2">
                <PackageCheck size={22} color="#94a3b8" />
              </View>
              <Text className="text-[14px] font-bold text-ink">최근 입고 내역이 없습니다</Text>
              <Text className="text-[12px] text-ink-3 mt-0.5 text-center">
                위 "라벨 스캔으로 입고"로 첫 입고를 시작하세요.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
