"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Package, AlertTriangle, Calendar, PackageCheck,
  Plus, Search, MoreVertical, Printer, PackagePlus,
  FileDown, QrCode, Eye, ChevronRight, Sparkles,
  ClipboardList, Info,
} from "lucide-react";

/* ── 타입 ── */
interface ProductInventory {
  id: string;
  productId: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  minOrderQty: number | null;
  location: string | null;
  expiryDate: string | null;
  notes: string | null;
  lotNumber?: string | null;
  storageCondition?: string | null;
  hazard?: boolean;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  product: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  };
}

/* ── 헬퍼 ── */
function isLowStock(inv: ProductInventory): boolean {
  if (inv.safetyStock !== null && inv.currentQuantity < inv.safetyStock) return true;
  if (inv.currentQuantity === 0) return true;
  const daily = inv.averageDailyUsage ?? 0;
  const lead = inv.leadTimeDays ?? 0;
  if (daily > 0 && lead > 0 && inv.currentQuantity <= daily * lead) return true;
  return false;
}

function isExpiringSoon(inv: ProductInventory): boolean {
  if (!inv.expiryDate) return false;
  const diff = new Date(inv.expiryDate).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

function isRecentlyUpdated(inv: ProductInventory): boolean {
  // updatedAt이 있으면 7일 이내인지 체크, 없으면 false
  const ua = (inv as any).updatedAt;
  if (!ua) return false;
  return Date.now() - new Date(ua).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function needsLot(inv: ProductInventory): boolean {
  return !inv.lotNumber;
}

type ItemStatus = "normal" | "low" | "expiring" | "tracking";
function getStatus(inv: ProductInventory): ItemStatus {
  if (isLowStock(inv)) return "low";
  if (isExpiringSoon(inv)) return "expiring";
  if (needsLot(inv)) return "tracking";
  return "normal";
}

const statusConfig: Record<ItemStatus, { label: string; color: string }> = {
  normal: { label: "정상", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  low: { label: "부족", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  expiring: { label: "만료임박", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  tracking: { label: "추적필요", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

/* ── KPI 카드 ── */
function KpiCard({ icon: Icon, label, value, accent, hint }: {
  icon: React.ElementType; label: string; value: number;
  accent: string; hint: string;
}) {
  return (
    <Card className="bg-pn border-bd">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={`h-3.5 w-3.5 ${accent}`} />
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-xl font-bold text-slate-200">{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
      </CardContent>
    </Card>
  );
}

/* ── 상태 뱃지 ── */
function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = statusConfig[status];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
      {cfg.label}
    </Badge>
  );
}

/* ── 빠른 작업 버튼 ── */
function QuickActions({ inv, onSelect }: {
  inv: ProductInventory; onSelect: (inv: ProductInventory) => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-200">
              <PackagePlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">입고</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-200">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">라벨</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-200"
              onClick={() => onSelect(inv)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">상세</p></TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* ── 우측 AI 운영 패널 ── */
function AiOpsPanel({ items, selected, lowCount, expiringCount, lotMissingCount }: {
  items: ProductInventory[];
  selected: ProductInventory | null;
  lowCount: number;
  expiringCount: number;
  lotMissingCount: number;
}) {
  return (
    <div className="bg-pn border border-bd rounded-xl p-4 space-y-4 h-fit sticky top-4">
      {/* 오늘의 우선 조치 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
          <h3 className="text-xs font-semibold text-slate-200">오늘의 우선 조치</h3>
        </div>
        <div className="space-y-2">
          <ActionRow
            count={lowCount}
            label="부족 위험 품목"
            action="재주문 검토"
            accent="text-red-400"
          />
          <ActionRow
            count={expiringCount}
            label="만료 임박"
            action="우선 사용 확인"
            accent="text-amber-400"
          />
          <ActionRow
            count={lotMissingCount}
            label="Lot 누락"
            action="정보 입력"
            accent="text-blue-400"
          />
        </div>
        {lowCount === 0 && expiringCount === 0 && lotMissingCount === 0 && (
          <p className="text-[11px] text-slate-500 mt-2">
            현재 조치가 필요한 항목이 없습니다. 재고 상태가 양호합니다.
          </p>
        )}
      </div>

      {/* 구분선 */}
      <div className="border-t border-bd" />

      {/* 선택된 품목 요약 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-xs font-semibold text-slate-200">품목 상세</h3>
        </div>
        {selected ? (
          <div className="space-y-2.5">
            <DetailRow label="품목명" value={selected.product.name} />
            <DetailRow
              label="수량 / 안전재고"
              value={`${selected.currentQuantity} ${selected.unit} / ${selected.safetyStock ?? "-"}`}
            />
            <DetailRow
              label="유효기간"
              value={selected.expiryDate
                ? new Date(selected.expiryDate).toLocaleDateString("ko-KR")
                : "-"}
            />
            <DetailRow label="위치" value={selected.location || "-"} />
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Button size="sm" variant="outline" className="text-[11px] h-7 border-bd gap-1">
                <ChevronRight className="h-3 w-3" />
                재주문 견적
              </Button>
              <Button size="sm" variant="outline" className="text-[11px] h-7 border-bd gap-1">
                <Printer className="h-3 w-3" />
                라벨 재출력
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">
            품목을 선택하면 상세 정보가 표시됩니다
          </p>
        )}
      </div>
    </div>
  );
}

function ActionRow({ count, label, action, accent }: {
  count: number; label: string; action: string; accent: string;
}) {
  return (
    <div className="flex items-center justify-between bg-el rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${accent}`}>{count}</span>
        <span className="text-[11px] text-slate-300">{label}</span>
      </div>
      {count > 0 && (
        <Button size="sm" variant="ghost" className="text-[10px] h-6 px-2 text-slate-400 hover:text-slate-200">
          {action}
          <ChevronRight className="h-3 w-3 ml-0.5" />
        </Button>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      <span className="text-[11px] text-slate-200 text-right truncate ml-3">{value}</span>
    </div>
  );
}

/* ── 빈 상태 시작 가이드 ── */
function EmptyGuide() {
  const steps = [
    { num: 1, text: "품목 등록 — 제품 정보와 초기 수량을 입력합니다" },
    { num: 2, text: "안전재고 설정 — 부족 알림 기준을 지정합니다" },
    { num: 3, text: "위치/Lot 기록 — 보관 위치와 Lot 번호를 추가합니다" },
    { num: 4, text: "운영 시작 — 입출고와 만료 관리를 자동으로 추적합니다" },
  ];
  return (
    <Card className="bg-pn border-bd border-dashed">
      <CardContent className="p-8 text-center">
        <Package className="h-8 w-8 text-slate-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-200">등록된 품목이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          품목을 등록하면 재고 현황, 부족 알림이 활성화됩니다
        </p>
        <div className="text-left max-w-sm mx-auto space-y-2 mb-4">
          {steps.map((s) => (
            <div key={s.num} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                {s.num}
              </span>
              <span className="text-[11px] text-slate-400">{s.text}</span>
            </div>
          ))}
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          첫 품목 등록
        </Button>
      </CardContent>
    </Card>
  );
}

/* ================================================================
   메인 컴포넌트
   ================================================================ */
export function InventoryContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProductInventory | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  /* 데이터 fetch */
  const { data: inventories, isLoading } = useQuery({
    queryKey: ["inventory-list"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) return [];
      const data = await res.json();
      return data.inventories ?? data ?? [];
    },
    enabled: !!session,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const items: ProductInventory[] = useMemo(
    () => (Array.isArray(inventories) ? inventories : []),
    [inventories],
  );

  /* KPI 계산 */
  const lowCount = useMemo(() => items.filter(isLowStock).length, [items]);
  const expiringCount = useMemo(() => items.filter(isExpiringSoon).length, [items]);
  const recentCount = useMemo(() => items.filter(isRecentlyUpdated).length, [items]);
  const lotMissingCount = useMemo(() => items.filter(needsLot).length, [items]);

  /* 필터링 */
  const filtered = useMemo(() => {
    let list = items;

    // 탭 필터
    if (activeTab === "action") {
      list = list.filter((i) => isLowStock(i) || isExpiringSoon(i));
    } else if (activeTab === "lot") {
      list = list.filter((i) => isExpiringSoon(i) || needsLot(i));
    }

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) =>
        i.product.name?.toLowerCase().includes(q) ||
        i.product.brand?.toLowerCase().includes(q) ||
        i.product.catalogNumber?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [items, activeTab, searchQuery]);

  /* ── 렌더 ── */
  return (
    <div className="space-y-4">
      {/* ▸ 헤더 + 액션 바 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">재고 관리</h1>
          <p className="text-sm text-slate-400">
            {items.length > 0
              ? `${items.length}개 품목 등록됨`
              : "품목을 등록하면 재고 현황이 표시됩니다"}
          </p>
        </div>

        {/* 데스크탑 액션 */}
        <div className="hidden md:flex items-center gap-2">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            재고 등록
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-bd">
            <PackagePlus className="h-3.5 w-3.5" />
            입고 반영
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-bd">
            <Printer className="h-3.5 w-3.5" />
            라벨 인쇄
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-bd">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-pn border-bd">
              <DropdownMenuItem className="text-xs gap-2">
                <FileDown className="h-3.5 w-3.5" />
                엑셀 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2">
                <QrCode className="h-3.5 w-3.5" />
                QR 일괄 생성
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 모바일 액션 */}
        <div className="flex md:hidden items-center gap-2">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            등록
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-bd">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-pn border-bd">
              <DropdownMenuItem className="text-xs gap-2">
                <PackagePlus className="h-3.5 w-3.5" />
                입고 반영
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2">
                <Printer className="h-3.5 w-3.5" />
                라벨 인쇄
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs gap-2">
                <FileDown className="h-3.5 w-3.5" />
                엑셀 내보내기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ▸ KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Package} label="전체 품목" value={items.length}
          accent="text-blue-400"
          hint={items.length === 0 ? "품목을 등록해 주세요" : "등록된 전체 품목 수"}
        />
        <KpiCard
          icon={AlertTriangle} label="부족 위험" value={lowCount}
          accent="text-red-400"
          hint={lowCount === 0 ? "모든 품목 재고 충분" : "안전재고 미만 품목"}
        />
        <KpiCard
          icon={Calendar} label="만료 임박" value={expiringCount}
          accent="text-amber-400"
          hint={expiringCount === 0 ? "30일 내 만료 품목 없음" : "30일 이내 만료 예정"}
        />
        <KpiCard
          icon={PackageCheck} label="최근 입고" value={recentCount}
          accent="text-emerald-400"
          hint={recentCount === 0 ? "최근 7일 내 입고 없음" : "최근 7일 내 업데이트"}
        />
      </div>

      {/* ▸ 본문 2컬럼 */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
        {/* 좌측: 재고 테이블 */}
        <div className="space-y-3">
          {/* 세그먼트 탭 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center gap-3">
              <TabsList className="bg-el border border-bd h-8">
                <TabsTrigger value="all" className="text-xs h-6 px-3">전체</TabsTrigger>
                <TabsTrigger value="action" className="text-xs h-6 px-3">
                  조치 필요
                  {(lowCount + expiringCount) > 0 && (
                    <span className="ml-1 text-[9px] bg-red-500/20 text-red-400 rounded-full px-1.5">
                      {lowCount + expiringCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lot" className="text-xs h-6 px-3">만료/Lot</TabsTrigger>
              </TabsList>
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="품목명, 브랜드, 카탈로그 번호..."
                    className="h-8 pl-8 text-xs bg-el border-bd"
                  />
                </div>
              </div>
            </div>

            {/* 테이블 콘텐츠 (탭 공유) */}
            <div className="mt-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-14 bg-el rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyGuide />
              ) : filtered.length === 0 ? (
                <Card className="bg-pn border-bd">
                  <CardContent className="p-6 text-center">
                    <Search className="h-6 w-6 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">검색 결과가 없습니다</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-pn border-bd overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-bd hover:bg-transparent">
                        <TableHead className="text-[11px] text-slate-400 h-9">품목명</TableHead>
                        <TableHead className="text-[11px] text-slate-400 h-9 w-20 text-right">수량</TableHead>
                        <TableHead className="text-[11px] text-slate-400 h-9 w-24 hidden md:table-cell">위치</TableHead>
                        <TableHead className="text-[11px] text-slate-400 h-9 w-20 text-center">상태</TableHead>
                        <TableHead className="text-[11px] text-slate-400 h-9 w-28 text-right">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.slice(0, 30).map((inv) => {
                        const status = getStatus(inv);
                        const isSelected = selectedItem?.id === inv.id;
                        return (
                          <TableRow
                            key={inv.id}
                            className={`border-bd cursor-pointer transition-colors ${
                              isSelected ? "bg-el" : "hover:bg-el/50"
                            }`}
                            onClick={() => setSelectedItem(inv)}
                          >
                            <TableCell className="py-2.5">
                              <p className="text-sm font-medium text-slate-100 truncate max-w-[240px]">
                                {inv.product.name || "품목명 없음"}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {inv.product.brand || ""}
                                {inv.product.catalogNumber ? ` · ${inv.product.catalogNumber}` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <span className="text-sm font-semibold text-slate-200">
                                {inv.currentQuantity}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1">{inv.unit}</span>
                            </TableCell>
                            <TableCell className="py-2.5 hidden md:table-cell">
                              <span className="text-[11px] text-slate-400 truncate block max-w-[100px]">
                                {inv.location || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-2.5">
                              <StatusBadge status={status} />
                            </TableCell>
                            <TableCell className="text-right py-2.5">
                              <QuickActions inv={inv} onSelect={setSelectedItem} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {filtered.length > 30 && (
                    <div className="px-4 py-2 border-t border-bd text-center">
                      <p className="text-[11px] text-slate-500">
                        {filtered.length}개 중 30개 표시 중 — 검색으로 범위를 좁혀 보세요
                      </p>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </Tabs>
        </div>

        {/* 우측: AI 운영 패널 (데스크탑만) */}
        <div className="hidden md:block">
          <AiOpsPanel
            items={items}
            selected={selectedItem}
            lowCount={lowCount}
            expiringCount={expiringCount}
            lotMissingCount={lotMissingCount}
          />
        </div>
      </div>
    </div>
  );
}
