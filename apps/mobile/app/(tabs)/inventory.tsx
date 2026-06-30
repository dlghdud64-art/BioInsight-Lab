/**
 * §labaxis-mobile-reskin Phase 1 — 03 재고 화면(목업 재현). 출처: design_handoff README §03.
 *
 * 공통 셸(ScreenHeader: navy + 요약 스트립) + 재발주 추천 배너(로즈) + 필터 칩 + 품목 카드(안전재고 게이지).
 * 데이터: useInventory(서버 truth). 재발주 추천 = LOW/OUT 상태 파생(가짜 수량 X — 실제 부족분만 표기).
 * 액션 wiring(no-op 0): 카드/상세/재발주 → /inventory/[id], 스캔 → /scan, 알림 → /notifications.
 * §12 inventory: 만료 = blocker/danger(strikethrough 금지). 상태 = 서버 status canonical.
 * §11.302: 위험/부족=rose · 주의/만료임박=amber(#b45821) · 정상=emerald.
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
  FlaskConical,
  Layers,
  MapPin,
  ChevronRight,
  Search,
  ScanLine,
  Bell,
  AlertTriangle,
  X,
} from "lucide-react-native";
import { useInventory } from "../../hooks/useApi";
import { ScreenHeader, FilterChips } from "../../components/shell";
import type { HeaderAction, SummaryCell, FilterChip } from "../../components/shell";
import { ErrorState } from "../../components/ErrorState";
import { EmptyState } from "../../components/EmptyState";
import type { ProductInventory } from "../../types";

const EXPIRY_SOON_DAYS = 60;

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}
function isExpiringSoon(inv: ProductInventory): boolean {
  const d = daysUntil(inv.expiryDate);
  return d !== null && d <= EXPIRY_SOON_DAYS && d >= 0;
}
function isDeficient(inv: ProductInventory): boolean {
  return inv.status === "LOW_STOCK" || inv.status === "OUT_OF_STOCK";
}

const FILTERS: FilterChip[] = [
  { key: "ALL", label: "전체" },
  { key: "LOW", label: "부족", danger: true },
  { key: "EXPIRING", label: "만료 임박" },
  { key: "NO_LOCATION", label: "위치 미지정" },
];

/* ── 상태 배지(§11.302 신호등) ── */
function StatusPill({ inv }: { inv: ProductInventory }) {
  let cls: string, label: string;
  if (inv.status === "OUT_OF_STOCK") {
    cls = "bg-rose text-white";
    label = "소진";
  } else if (inv.status === "LOW_STOCK") {
    cls = "bg-rose-weak text-rose-deep";
    label = "부족";
  } else if (isExpiringSoon(inv)) {
    cls = "bg-amber-weak text-amber";
    label = "만료 임박";
  } else {
    cls = "bg-emerald-weak text-emerald-deep";
    label = "정상";
  }
  const [bg, fg] = cls.split(" ");
  return (
    <View className={`${bg} px-2 py-0.5 rounded-full`}>
      <Text className={`${fg} text-[11px] font-bold`}>{label}</Text>
    </View>
  );
}

/* ── 안전재고 게이지 ── */
function SafetyGauge({ inv }: { inv: ProductInventory }) {
  const safety = inv.safetyStock ?? 0;
  const low = isDeficient(inv);
  const fillColor = low
    ? "bg-rose"
    : isExpiringSoon(inv)
      ? "bg-amber"
      : "bg-emerald";
  const pct =
    safety > 0 ? Math.max(0, Math.min(1, inv.quantity / safety)) : 1;
  return (
    <View className="mt-2.5">
      <View className="flex-row items-end justify-between mb-1">
        <Text className="text-[12px] text-ink-3">
          현재{" "}
          <Text className={`text-[14px] font-extrabold ${low ? "text-rose-deep" : "text-ink"}`}>
            {inv.quantity}
          </Text>
          <Text className="text-[11px] text-ink-4"> {inv.unit || "ea"}</Text>
        </Text>
        {safety > 0 ? (
          <Text className="text-[11px] text-ink-4">안전재고 {safety}</Text>
        ) : null}
      </View>
      <View className="h-1.5 rounded-full bg-surface-line overflow-hidden">
        <View
          className={`h-full rounded-full ${fillColor}`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </View>
    </View>
  );
}

/* ── 품목 카드 ── */
function InventoryCard({ item }: { item: ProductInventory }) {
  const low = isDeficient(item);
  const name = item.productName || item.product?.name || "(이름 없음)";
  const brand = item.brand || item.product?.brand;
  const catalog = item.catalogNumber || item.product?.catalogNumber;
  const lotCount = item.lots?.length ?? 0;
  const expDays = daysUntil(item.expiryDate);
  const goDetail = () => router.push(`/inventory/${item.id}`);
  return (
    <Pressable
      onPress={goDetail}
      accessibilityRole="button"
      accessibilityLabel={`${name} 상세`}
      className={`bg-surface-paper rounded-card border p-[14px] mb-3 ${
        low ? "border-rose-line" : "border-surface-line"
      }`}
    >
      {/* 헤더 행 */}
      <View className="flex-row items-start gap-2.5">
        <View
          className={`w-9 h-9 rounded-field items-center justify-center ${
            low ? "bg-rose-weak" : "bg-accent-weak"
          }`}
        >
          <FlaskConical size={18} color={low ? "#e11d48" : "#2563eb"} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[16px] font-extrabold text-ink flex-1 mr-2" numberOfLines={1}>
              {name}
            </Text>
            <StatusPill inv={item} />
          </View>
          {brand || catalog ? (
            <Text className="text-[12px] text-ink-3 mt-0.5" numberOfLines={1}>
              {brand}
              {brand && catalog ? " · " : ""}
              {catalog}
            </Text>
          ) : null}
        </View>
      </View>

      {/* 안전재고 게이지 */}
      <SafetyGauge inv={item} />

      {/* 푸터: LOT/위치/만료 + 액션 */}
      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-surface-line-soft">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Layers size={13} color="#94a3b8" />
            <Text className="text-[12px] text-ink-3">{lotCount} LOT</Text>
          </View>
          {item.location ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={13} color="#94a3b8" />
              <Text className="text-[12px] text-ink-3">{item.location}</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-1">
              <MapPin size={13} color="#e11d48" />
              <Text className="text-[12px] text-rose-deep font-semibold">위치 미지정</Text>
            </View>
          )}
          {expDays !== null && expDays >= 0 && expDays <= EXPIRY_SOON_DAYS ? (
            <Text className="text-[12px] text-amber font-semibold">D-{expDays}</Text>
          ) : null}
        </View>
        {low ? (
          <View className="flex-row items-center gap-1 bg-rose-weak border border-rose-line px-2.5 py-1 rounded-full">
            <Text className="text-[12px] text-rose-deep font-bold">재발주 검토</Text>
            <ChevronRight size={13} color="#be123c" />
          </View>
        ) : (
          <View className="flex-row items-center gap-0.5">
            <Text className="text-[12px] text-ink-3 font-semibold">상세</Text>
            <ChevronRight size={14} color="#94a3b8" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function InventoryScreen() {
  const { data: inventories, isLoading, isError, refetch, isRefetching } =
    useInventory();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const all = inventories ?? [];

  const deficientList = useMemo(() => all.filter(isDeficient), [all]);
  const expiringCount = useMemo(() => all.filter(isExpiringSoon).length, [all]);
  const summary: SummaryCell[] = [
    { value: String(all.length), unit: "종", label: "전체 품목" },
    {
      value: String(deficientList.length),
      label: "안전재고 미달",
      alert: deficientList.length > 0,
    },
    { value: String(expiringCount), label: "만료 임박" },
  ];

  // 재발주 추천: 부족분 큰 1건(가짜 수량 없이 실제 gap 만).
  const topReco = useMemo(() => {
    const withGap = deficientList
      .map((inv) => ({ inv, gap: (inv.safetyStock ?? 0) - inv.quantity }))
      .sort((a, b) => b.gap - a.gap);
    return withGap[0]?.inv ?? null;
  }, [deficientList]);

  const filtered = all.filter((inv) => {
    const matchSearch = search
      ? (inv.productName || inv.product?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      : true;
    let matchFilter = true;
    if (filter === "LOW") matchFilter = isDeficient(inv);
    else if (filter === "EXPIRING") matchFilter = isExpiringSoon(inv);
    else if (filter === "NO_LOCATION") matchFilter = !inv.location;
    return matchSearch && matchFilter;
  });

  const actions: HeaderAction[] = [
    {
      icon: Search,
      onPress: () => setSearchOpen((v) => !v),
      accessibilityLabel: "검색",
    },
    {
      icon: ScanLine,
      onPress: () => router.push("/scan"),
      emphasized: true,
      accessibilityLabel: "QR 스캔 입·출고",
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
        title="재고 관리"
        actions={actions}
        summary={summary}
      />

      {searchOpen ? (
        <View className="px-4 pt-3 flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center bg-surface-paper border border-surface-line rounded-field px-3 min-h-[44px]">
            <Search size={16} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="품목명 검색…"
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

      {topReco ? (
        <Pressable
          onPress={() => router.push(`/inventory/${topReco.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${topReco.productName || topReco.product?.name} 재발주 검토`}
          className="mx-4 mt-3 bg-rose-weak border border-rose-line rounded-card px-3.5 py-3 flex-row items-center gap-3"
        >
          <AlertTriangle size={18} color="#e11d48" />
          <View className="flex-1">
            <Text className="text-[13.5px] font-extrabold text-rose-deep" numberOfLines={1}>
              {topReco.productName || topReco.product?.name} 재발주 검토 권장
            </Text>
            <Text className="text-[12px] text-rose-deep/80 mt-0.5">
              현재 {topReco.quantity}
              {topReco.unit || "ea"}
              {topReco.safetyStock
                ? ` · 안전재고 ${topReco.safetyStock} 대비 ${Math.max(
                    0,
                    topReco.safetyStock - topReco.quantity,
                  )} 부족`
                : ""}
            </Text>
          </View>
          <View className="bg-rose px-3 py-1.5 rounded-full">
            <Text className="text-white text-[12px] font-bold">검토</Text>
          </View>
        </Pressable>
      ) : null}

      <View className="pt-3 pb-1">
        <FilterChips chips={FILTERS} value={filter} onChange={setFilter} />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#2563eb" className="mt-10" />
      ) : isError ? (
        <ErrorState
          title="재고를 불러오지 못했습니다"
          description="네트워크 상태를 확인하고 다시 시도해주세요."
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InventoryCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            search.trim() !== "" || filter !== "ALL" ? (
              <EmptyState
                title="조건에 맞는 재고가 없습니다"
                description="필터를 해제하면 전체 재고를 볼 수 있습니다."
                actionLabel="필터 초기화"
                onAction={() => {
                  setSearch("");
                  setFilter("ALL");
                }}
              />
            ) : (
              <EmptyState
                title="재고 품목이 없습니다"
                description="웹에서 재고를 등록하거나 입고 처리하세요."
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
