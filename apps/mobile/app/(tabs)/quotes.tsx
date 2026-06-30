/**
 * §labaxis-mobile-reskin Phase 2 — 02 견적 화면(목업 재현). 출처: design_handoff README §02.
 *
 * 공통 셸 + "지금 할 일" 우선 카드 + 단계 칩 + 케이스 카드 큐(단계 레일·상태 배지·금액·단계별 next-step).
 * ⚠️ 정직 매핑: Quote 타입 실필드(title/status/totalAmount/itemCount/requesterName/updatedAt)만 사용.
 *   목업의 우선순위·마감 D-day·공급사 수·회신 진행바는 API 미제공 → 미표기(가짜 금지).
 * ⚠️ mockup "AI 추천 .ai" → CLAUDE.md "AI/chatbot UI 신규 금지" 준수 위해 "지금 할 일"(contextual
 *   next-step)로 재해석. AI 브랜딩 제거. 우선건 선정은 실필드(단계+updatedAt) 휴리스틱.
 * 액션 wiring(no-op 0): 모든 카드/액션 → /quotes/[id], 스캔 → /scan, 알림 → /notifications.
 * §11.302: 발송대기=accent / 회신추적=amber / 비교검토=violet / 승인·입고=emerald.
 */
import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import {
  Clock,
  ChevronRight,
  Users,
  Search,
  Bell,
  X,
} from "lucide-react-native";
import { useQuotes } from "../../hooks/useApi";
import { ScreenHeader, FilterChips } from "../../components/shell";
import type { HeaderAction, SummaryCell, FilterChip } from "../../components/shell";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import type { Quote } from "../../types";

type Stage = "s1" | "s2" | "s3" | "s4" | "x";

function stageOf(status: Quote["status"]): Stage {
  switch (status) {
    case "DRAFT":
    case "PENDING":
      return "s1"; // 발송 대기
    case "SENT":
    case "WAITING_REPLY":
    case "VENDOR_INQUIRY":
      return "s2"; // 회신 추적
    case "RESPONDED":
    case "IN_PROGRESS":
      return "s3"; // 비교 검토
    case "COMPLETED":
    case "PURCHASED":
    case "ON_HOLD":
      return "s4"; // 승인·입고
    default:
      return "x"; // CANCELLED 등
  }
}

const STAGE_META: Record<
  Stage,
  { label: string; rail: string; pillBg: string; pillFg: string; action: string }
> = {
  s1: { label: "발송 대기", rail: "bg-accent", pillBg: "bg-accent-weak", pillFg: "text-accent", action: "발송 준비" },
  s2: { label: "회신 추적", rail: "bg-amber", pillBg: "bg-amber-weak", pillFg: "text-amber", action: "리마인더" },
  s3: { label: "비교 검토", rail: "bg-violet", pillBg: "bg-violet-weak", pillFg: "text-violet", action: "비교 검토" },
  s4: { label: "승인·입고", rail: "bg-emerald", pillBg: "bg-emerald-weak", pillFg: "text-emerald-deep", action: "승인·입고" },
  x: { label: "취소", rail: "bg-ink-4", pillBg: "bg-surface-line", pillFg: "text-ink-3", action: "상세" },
};

const FILTERS: FilterChip[] = [
  { key: "ALL", label: "전체" },
  { key: "s1", label: "발송 대기" },
  { key: "s2", label: "회신 추적" },
  { key: "s3", label: "비교 검토" },
  { key: "s4", label: "승인·입고" },
];

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}
function relTime(iso?: string): string {
  const d = daysSince(iso);
  if (d === null) return "";
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  if (d < 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}
function formatAmount(n?: number): string {
  if (!n) return "-";
  return `₩${n.toLocaleString("ko-KR")}`;
}

/* ── 케이스 카드 ── */
function QuoteCard({ item }: { item: Quote }) {
  const stage = stageOf(item.status);
  const meta = STAGE_META[stage];
  const go = () => router.push(`/quotes/${item.id}`);
  return (
    <Pressable
      onPress={go}
      accessibilityRole="button"
      accessibilityLabel={`${item.title || "견적"} 상세`}
      className="bg-surface-paper rounded-card border border-surface-line mb-3 overflow-hidden flex-row"
    >
      {/* 단계 레일 */}
      <View className={`w-1 ${meta.rail}`} />
      <View className="flex-1 p-[14px]">
        {/* 헤더: 단계 pill + 제목 */}
        <View className="flex-row items-center justify-between mb-1.5">
          <View className={`${meta.pillBg} px-2 py-0.5 rounded-full`}>
            <Text className={`${meta.pillFg} text-[11px] font-bold`}>{meta.label}</Text>
          </View>
          {item.itemCount !== undefined ? (
            <Text className="text-[11px] text-ink-4">{item.itemCount}개 품목</Text>
          ) : null}
        </View>
        <Text className="text-[15.5px] font-extrabold text-ink" numberOfLines={2}>
          {item.title || "(제목 없음)"}
        </Text>

        {/* 메타: 요청자 + 갱신 시각 */}
        <View className="flex-row items-center gap-3 mt-2">
          {item.requesterName ? (
            <View className="flex-row items-center gap-1">
              <Users size={12} color="#94a3b8" />
              <Text className="text-[12px] text-ink-3">{item.requesterName}</Text>
            </View>
          ) : null}
          {relTime(item.updatedAt) ? (
            <View className="flex-row items-center gap-1">
              <Clock size={12} color="#94a3b8" />
              <Text className="text-[12px] text-ink-3">{relTime(item.updatedAt)}</Text>
            </View>
          ) : null}
        </View>

        {/* 푸터: 금액 + 단계 next-step(상세로 라우팅) */}
        <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-surface-line-soft">
          <Text className="text-[15px] font-extrabold text-accent-strong">
            {formatAmount(item.totalAmount)}
          </Text>
          <View className="flex-row items-center gap-0.5">
            <Text className="text-[12px] text-ink-2 font-semibold">{meta.action}</Text>
            <ChevronRight size={14} color="#94a3b8" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function QuotesScreen() {
  const { data: quotes, isLoading, isError, refetch, isRefetching } =
    useQuotes("ALL");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const all = quotes ?? [];

  const counts = useMemo(() => {
    let active = 0,
      waiting = 0,
      review = 0;
    for (const q of all) {
      const s = stageOf(q.status);
      if (s === "s1" || s === "s2" || s === "s3") active++;
      if (s === "s2") waiting++;
      if (s === "s3") review++;
    }
    return { active, waiting, review };
  }, [all]);

  const summary: SummaryCell[] = [
    { value: String(counts.active), unit: "건", label: "진행 중" },
    { value: String(counts.waiting), label: "회신 대기", alert: counts.waiting > 0 },
    { value: String(counts.review), label: "비교 검토" },
  ];

  // "지금 할 일": 회신 추적(s2) 중 가장 오래 갱신 안 된 건, 없으면 발송 대기(s1) 최우선. (AI 아님)
  const topTask = useMemo(() => {
    const byOld = (a: Quote, b: Quote) =>
      (daysSince(a.updatedAt) ?? 0) > (daysSince(b.updatedAt) ?? 0) ? -1 : 1;
    const s2 = all.filter((q) => stageOf(q.status) === "s2").sort(byOld);
    if (s2[0]) return { q: s2[0], reason: `회신 대기 ${daysSince(s2[0].updatedAt) ?? 0}일` };
    const s1 = all.filter((q) => stageOf(q.status) === "s1").sort(byOld);
    if (s1[0]) return { q: s1[0], reason: "발송 준비 필요" };
    return null;
  }, [all]);

  const filtered = all.filter((q) => {
    const matchSearch = search
      ? (q.title ?? "").toLowerCase().includes(search.toLowerCase())
      : true;
    const matchFilter = filter === "ALL" ? true : stageOf(q.status) === filter;
    return matchSearch && matchFilter;
  });

  const actions: HeaderAction[] = [
    { icon: Search, onPress: () => setSearchOpen((v) => !v), accessibilityLabel: "검색" },
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
        title="견적 관리"
        actions={actions}
        summary={summary}
      />

      {searchOpen ? (
        <View className="px-4 pt-3">
          <View className="flex-row items-center bg-surface-paper border border-surface-line rounded-field px-3 min-h-[44px]">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="견적명 검색…"
              placeholderTextColor="#94a3b8"
              autoFocus
              className="flex-1 ml-2 text-[14px] text-ink"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} accessibilityLabel="검색어 지우기">
                <X size={16} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 지금 할 일(navy) — AI 아님, contextual next-step */}
      {topTask ? (
        <Pressable
          onPress={() => router.push(`/quotes/${topTask.q.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`지금 할 일: ${topTask.q.title}`}
          className="mx-4 mt-3 bg-navy-900 rounded-card px-4 py-3.5"
        >
          <View className="flex-row items-center gap-1.5">
            <Clock size={13} color="#bfdbfe" />
            <Text className="text-[11px] font-bold text-accent-line">지금 할 일</Text>
          </View>
          <Text className="text-white text-[15px] font-extrabold mt-1.5" numberOfLines={1}>
            {topTask.q.title || "(제목 없음)"}
          </Text>
          <Text className="text-white/60 text-[12.5px] mt-0.5">
            {STAGE_META[stageOf(topTask.q.status)].label} · {topTask.reason}
          </Text>
          <View className="flex-row mt-3">
            <View className="bg-white px-3.5 py-2 rounded-full flex-row items-center gap-1">
              <Text className="text-navy-900 text-[13px] font-bold">바로 열기</Text>
              <ChevronRight size={14} color="#0f172a" />
            </View>
          </View>
        </Pressable>
      ) : null}

      {/* 단계 칩 */}
      <View className="pt-3 pb-1">
        <FilterChips chips={FILTERS} value={filter} onChange={setFilter} />
      </View>

      {/* 큐 */}
      {isLoading ? (
        <ActivityIndicator color="#2563eb" className="mt-10" />
      ) : isError ? (
        <ErrorState
          title="견적을 불러오지 못했습니다"
          description="네트워크 상태를 확인하고 다시 시도해주세요."
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <QuoteCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            search.trim() !== "" || filter !== "ALL" ? (
              <EmptyState
                title="조건에 맞는 견적이 없습니다"
                description="필터를 해제하면 전체 견적을 볼 수 있습니다."
                actionLabel="필터 초기화"
                onAction={() => {
                  setSearch("");
                  setFilter("ALL");
                }}
              />
            ) : (
              <EmptyState
                title="견적이 없습니다"
                description="웹에서 제품을 검색하고 견적을 요청하세요."
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      )}
    </View>
  );
}
