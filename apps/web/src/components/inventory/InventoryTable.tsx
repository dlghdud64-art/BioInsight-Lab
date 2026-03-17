"use client";

import { useState, useMemo, Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertTriangle, Thermometer, Snowflake, Ban, PackagePlus,
  MoreVertical, Pencil, Eye, Trash2, ChevronRight, ChevronDown,
  Clock, RotateCcw, Printer, MapPin, Package,
  PackageX, Truck, ArrowLeftRight, QrCode,
} from "lucide-react";
import { format } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

/* ── 타입 정의 ── */

interface InventoryItem {
  id: string;
  productId: string;
  currentQuantity: number;
  unit: string;
  safetyStock: number | null;
  minOrderQty: number | null;
  location: string | null;
  expiryDate: string | null;
  notes: string | null;
  autoReorderEnabled?: boolean;
  autoReorderThreshold?: number;
  lotNumber?: string | null;
  storageCondition?: string | null;
  hazard?: boolean;
  testPurpose?: string | null;
  vendor?: string | null;
  deliveryPeriod?: string | null;
  inUseOrUnopened?: string | null;
  averageExpiry?: string | null;
  averageDailyUsage?: number;
  leadTimeDays?: number;
  product: {
    id: string;
    name: string;
    brand: string | null;
    catalogNumber: string | null;
  };
  restockRecords?: Array<{
    id: string;
    lotNumber: string | null;
    expiryDate: string | null;
    quantity: number;
  }>;
}

/** 품목별 그룹 */
interface ProductGroup {
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  totalQuantity: number;
  unit: string;
  lotCount: number;
  earliestExpiry: string | null;
  safetyStock: number | null;
  lots: InventoryItem[];
}

/* ── 그룹핑 ── */

function groupByProduct(inventories: InventoryItem[]): ProductGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const inv of inventories) {
    const key = inv.productId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inv);
  }
  const groups: ProductGroup[] = [];
  for (const [productId, lots] of map) {
    const first = lots[0];
    const totalQuantity = lots.reduce((sum, l) => sum + l.currentQuantity, 0);
    const expiries = lots
      .map((l) => l.expiryDate)
      .filter((d): d is string => d !== null && d !== undefined)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const earliestExpiry = expiries[0] ?? null;
    const safetyStocks = lots.map((l) => l.safetyStock).filter((s): s is number => s !== null);
    const safetyStock = safetyStocks.length > 0 ? Math.max(...safetyStocks) : null;
    groups.push({
      productId,
      productName: first.product.name,
      brand: first.product.brand,
      catalogNumber: first.product.catalogNumber,
      totalQuantity,
      unit: first.unit,
      lotCount: lots.length,
      earliestExpiry,
      safetyStock,
      lots,
    });
  }
  return groups;
}

/* ── 상태 판별 유틸 ── */

type GroupStatus = "부족" | "주의" | "정상";

function getGroupStatus(group: ProductGroup): GroupStatus {
  if (group.totalQuantity === 0) return "부족";
  if (group.safetyStock !== null && group.totalQuantity <= group.safetyStock) return "부족";
  if (group.safetyStock !== null && group.totalQuantity <= group.safetyStock * 1.5) return "주의";
  return "정상";
}

function getLotStatus(inv: InventoryItem): string {
  const dailyUsage = inv.averageDailyUsage ?? 0;
  const leadTime = inv.leadTimeDays ?? 0;
  if (dailyUsage > 0 && leadTime > 0 && inv.currentQuantity <= dailyUsage * leadTime) {
    const daysLeft = Math.floor(inv.currentQuantity / dailyUsage);
    return daysLeft <= 7 ? `소진 임박 (D-${daysLeft})` : "재주문 권장";
  }
  if (inv.currentQuantity === 0) return "부족";
  if (inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock) return "부족";
  return "정상";
}

function isExpiringSoon(d: string | null): boolean {
  if (!d) return false;
  const exp = new Date(d);
  const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
  return days > 0 && days <= 30;
}

function isExpired(d: string | null): boolean {
  if (!d) return false;
  return new Date(d).getTime() < Date.now();
}

function getExpiryDays(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

/** 위험도 점수: 높을수록 먼저 노출 */
function getRiskScore(group: ProductGroup): number {
  let score = 0;
  const status = getGroupStatus(group);
  if (status === "부족") score += 100;
  else if (status === "주의") score += 50;
  if (isExpired(group.earliestExpiry)) score += 200;
  else if (isExpiringSoon(group.earliestExpiry)) score += 80;
  // 위치 미지정 lot이 있으면 가산
  if (group.lots.some((l) => !l.location)) score += 20;
  return score;
}

/* ── 상태 배지 렌더링 ── */

const BADGE_BASE = "inline-flex items-center justify-center rounded-full shadow-none ring-2 ring-slate-900/50 shrink-0";

function StatusBadge({ status }: { status: string }) {
  const isShort = status === "부족" || status === "out_of_stock" || status === "low";
  const isImpending = status.startsWith("소진 임박") || status === "재주문 권장";
  const isWarning = status === "주의" || status === "warning";
  const isExpiry = status === "임박";
  const isDiscarded = status === "폐기";

  if (isShort || isImpending || isDiscarded) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className={`h-6 w-6 ${BADGE_BASE}bg-red-900/50 text-red-400`}>
          <Ban className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold text-red-400 whitespace-nowrap">{isDiscarded ? "폐기" : isImpending ? status : "부족"}</span>
      </span>
    );
  }
  if (isWarning) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className={`h-6 w-6 ${BADGE_BASE}bg-orange-900/50 text-orange-400`}>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold text-orange-400 whitespace-nowrap">주의</span>
      </span>
    );
  }
  if (isExpiry) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className={`h-6 w-6 ${BADGE_BASE}bg-amber-900/50 text-amber-400`}>
          <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[11px] font-semibold text-amber-400 whitespace-nowrap">임박</span>
      </span>
    );
  }
  // 정상
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-6 w-6 ${BADGE_BASE}bg-emerald-900/50 text-emerald-400`}>
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[11px] font-semibold text-emerald-400 whitespace-nowrap">정상</span>
    </span>
  );
}

/* ── 보관 조건 렌더링 ── */

function StorageConditionTag({ cond }: { cond: string | null | undefined }) {
  if (!cond) return <span className="text-xs text-muted-foreground">-</span>;
  const label = getStorageConditionLabel(cond);
  const isFreezer = /freezer_20|deep_freezer_80|ln2/i.test(cond);
  const isFridge = /fridge/i.test(cond);
  const Icon = isFreezer ? Snowflake : Thermometer;
  const cls = isFreezer
    ? "bg-blue-900/20 text-blue-400"
    : isFridge
      ? "bg-cyan-900/20 text-cyan-400"
      : "bg-slate-800 text-slate-400";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${cls}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

/* ── 컴포넌트 Props ── */

interface InventoryTableProps {
  inventories: InventoryItem[];
  onEdit: (inventory: InventoryItem) => void;
  onDelete?: (inventory: InventoryItem) => void;
  onReorder: (inventory: InventoryItem) => void;
  onDetailClick?: (inventory: InventoryItem) => void;
  onRestock?: (inventory: InventoryItem) => void;
  onConsume?: (inventory: InventoryItem) => void;
  onMoveLocation?: (inventory: InventoryItem) => void;
  onPrintLabel?: (productName: string, lots: InventoryItem[]) => void;
  emptyMessage?: string;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}

/* ── 메인 컴포넌트 ── */

export function InventoryTable({
  inventories,
  onEdit,
  onDelete,
  onReorder,
  onDetailClick,
  onRestock,
  onConsume,
  onMoveLocation,
  onPrintLabel,
  emptyMessage = "아직 등록된 재고가 없습니다. 첫 재고를 등록해보세요.",
  emptyAction,
  emptyActionLabel = "첫 재고 등록하기"
}: InventoryTableProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // 위험 중심 정렬: 부족/만료/임박 품목 상단 우선 노출
  const sortedGroups = useMemo(() => {
    const groups = groupByProduct(inventories);
    return groups.sort((a, b) => getRiskScore(b) - getRiskScore(a));
  }, [inventories]);

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950 shadow-none">
      {/* ══ 모바일: 품목 카드 + Lot 아코디언 ══ */}
      <div className="md:hidden">
        {sortedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <Package className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-sm text-muted-foreground mb-4 text-center">{emptyMessage}</p>
            {emptyAction && (
              <Button onClick={emptyAction} size="sm">{emptyActionLabel}</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {sortedGroups.map((group) => {
              const groupStatus = getGroupStatus(group);
              const expiryStatus = isExpired(group.earliestExpiry) ? "폐기" : isExpiringSoon(group.earliestExpiry) ? "임박" : null;
              const displayStatus = expiryStatus ?? groupStatus;
              const expiryDays = getExpiryDays(group.earliestExpiry);
              const isRisky = displayStatus === "부족" || displayStatus === "폐기" || displayStatus === "임박";
              const isExpanded = expandedProducts.has(group.productId);

              return (
                <div
                  key={group.productId}
                  className={`${isRisky ? "bg-red-950/10" : ""}`}
                >
                  {/* ── 품목 카드 ── */}
                  <div className="px-3.5 py-3">
                    {/* 1행: 품목명 + 상태 배지 */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className="text-sm font-bold text-slate-100 line-clamp-1 flex-1 min-w-0 cursor-pointer"
                        onClick={() => onDetailClick?.(group.lots[0])}
                      >
                        {group.productName}
                      </h3>
                      <StatusBadge status={displayStatus} />
                    </div>

                    {/* 2행: 총 수량 · D-day · Lot 개수 */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5">
                      <span className="flex items-center gap-1">
                        <span className={`font-bold text-sm${
                          groupStatus === "부족" ? "text-red-400" :
                          groupStatus === "주의" ? "text-orange-400" :
                          "text-slate-100"
                        }`}>
                          총 {group.totalQuantity}
                        </span>
                        <span>{group.unit}</span>
                      </span>
                      {group.earliestExpiry && (
                        <>
                          <span className="text-slate-300 text-slate-400">·</span>
                          <span className={`flex items-center gap-0.5 ${
                            isExpired(group.earliestExpiry) ? "text-red-500" :
                            isExpiringSoon(group.earliestExpiry) ? "text-amber-500" :
                            "text-slate-400"
                          }`}>
                            <Clock className="h-3 w-3 shrink-0" />
                            {isExpired(group.earliestExpiry) ? "만료" :
                             expiryDays !== null && expiryDays <= 30 ? `D-${expiryDays}` :
                             format(new Date(group.earliestExpiry), "MM.dd")}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300 text-slate-400">·</span>
                      <span className="text-[11px]">Lot {group.lotCount}개</span>
                    </div>

                    {/* 3행: 품목 액션 */}
                    <div className="flex items-center gap-1.5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      {onRestock && !isRisky && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] gap-1 text-emerald-400 border-emerald-200 hover:bg-emerald-50 border-emerald-800 hover:bg-emerald-950"
                          onClick={() => onRestock(group.lots[0])}
                        >
                          <PackagePlus className="h-3 w-3 shrink-0" />
                          입고
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2.5 text-[11px] gap-1${
                          isRisky
                            ? groupStatus === "부족" || displayStatus === "폐기"
                              ? "text-red-400 border-red-200 hover:bg-red-50 border-red-800 hover:bg-red-950"
                              : "text-amber-400 border-amber-200 hover:bg-amber-50 border-amber-800 hover:bg-amber-950"
                            : "text-slate-400 border-slate-800 hover:bg-slate-900 border-slate-700 hover:bg-slate-800"
                        }`}
                        onClick={() => onReorder(group.lots[0])}
                      >
                        <RotateCcw className="h-3 w-3 shrink-0" />
                        재발주
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-7 px-2.5 text-[11px] gap-1 ml-auto${
                          isExpanded
                            ? "text-blue-400 border-blue-200 bg-blue-50/50 border-blue-800 bg-blue-950/30"
                            : "text-slate-500 border-slate-700"
                        }`}
                        onClick={() => toggleExpand(group.productId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0" />
                        )}
                        Lot {group.lotCount}개 보기
                      </Button>
                    </div>
                  </div>

                  {/* ── Lot 아코디언 (카드형) ── */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-900/50 bg-slate-900/30 px-3 py-2 space-y-2">
                      {group.lots.map((lot) => {
                        const lotExpDays = getExpiryDays(lot.expiryDate);
                        const lotSt = getLotStatus(lot);
                        const lotExpired = isExpired(lot.expiryDate);
                        const lotExpiringSoon = isExpiringSoon(lot.expiryDate);
                        const lotUrgent = lotSt === "부족" || lotExpired || lotSt.startsWith("소진 임박");
                        return (
                          <div
                            key={lot.id}
                            className={`rounded-lg border p-3 ${
                              lotUrgent
                                ? "border-red-200 bg-red-50/40 border-red-900 bg-red-950/20"
                                : lotExpiringSoon
                                  ? "border-amber-200 bg-amber-50/30 border-amber-900 bg-amber-950/20"
                                  : "border-slate-800 bg-slate-900 border-slate-700 bg-slate-900/60"
                            }`}
                          >
                            {/* 1행: Lot 번호 + 수량 + 상태 */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-bold text-slate-200 truncate max-w-[120px]">
                                  {lot.lotNumber || "Lot 미지정"}
                                </span>
                                <span className="text-xs font-semibold text-slate-300 shrink-0">
                                  {lot.currentQuantity}<span className="text-slate-400 font-normal ml-0.5">{lot.unit}</span>
                                </span>
                              </div>
                              <StatusBadge status={lotExpired ? "폐기" : lotExpiringSoon ? "임박" : lotSt} />
                            </div>

                            {/* 2행: 메타 정보 */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap mb-2">
                              <StorageConditionTag cond={lot.storageCondition} />
                              {lot.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  {lot.location}
                                </span>
                              )}
                              {lot.expiryDate && (
                                <span className={`${
                                  lotExpired ? "text-red-500 font-semibold" :
                                  lotExpiringSoon ? "text-amber-500 font-semibold" :
                                  "text-slate-400"
                                }`}>
                                  {format(new Date(lot.expiryDate), "yyyy.MM.dd")}
                                  {lotExpDays !== null && lotExpDays <= 30 && (
                                    <span className="ml-0.5">
                                      {lotExpDays <= 0 ? "(만료)" : `(D-${lotExpDays})`}
                                    </span>
                                  )}
                                </span>
                              )}
                              {lot.inUseOrUnopened && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-700">
                                  {lot.inUseOrUnopened}
                                </Badge>
                              )}
                            </div>

                            {/* 3행: Lot 액션 (출고 중심) */}
                            <div className="flex items-center gap-1.5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              {onConsume && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`h-7 px-2.5 text-[11px] gap-1${
                                    lotUrgent
                                      ? "text-red-400 border-red-200 hover:bg-red-50 border-red-800 hover:bg-red-950"
                                      : "text-slate-400 border-slate-800 hover:bg-slate-800 border-slate-700 hover:bg-slate-800"
                                  }`}
                                  onClick={() => onConsume(lot)}
                                >
                                  <Truck className="h-3 w-3 shrink-0" />
                                  출고
                                </Button>
                              )}
                              {onPrintLabel && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px] gap-1 text-indigo-400 border-indigo-200 hover:bg-indigo-50 border-indigo-800 hover:bg-indigo-950"
                                  onClick={() => onPrintLabel(group.productName, [lot])}
                                >
                                  <Printer className="h-3 w-3 shrink-0" />
                                  라벨
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 ml-auto">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => onDetailClick?.(lot)} className="gap-2 text-xs">
                                    <Eye className="h-3.5 w-3.5 text-blue-500" /> 상세 보기
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onEdit(lot)} className="gap-2 text-xs">
                                    <Pencil className="h-3.5 w-3.5 text-slate-500" /> 정보 수정
                                  </DropdownMenuItem>
                                  {onMoveLocation && (
                                    <DropdownMenuItem onClick={() => onMoveLocation(lot)} className="gap-2 text-xs">
                                      <ArrowLeftRight className="h-3.5 w-3.5 text-slate-500" /> 위치 이동
                                    </DropdownMenuItem>
                                  )}
                                  {onDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => onDelete(lot)} className="gap-2 text-xs text-red-400 focus:text-red-400">
                                        <Trash2 className="h-3.5 w-3.5" /> 삭제
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ 데스크탑: 테이블 ══ */}
      <div className="hidden md:block w-full overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-slate-900/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[44px] text-xs font-semibold text-slate-400 whitespace-nowrap"></TableHead>
              <TableHead className="w-[100px] text-xs font-semibold text-slate-400 whitespace-nowrap">상태</TableHead>
              <TableHead className="min-w-[220px] text-xs font-semibold text-slate-400 whitespace-nowrap">품목 정보</TableHead>
              <TableHead className="w-[110px] text-right text-xs font-semibold text-slate-400 whitespace-nowrap">총 수량</TableHead>
              <TableHead className="w-[80px] text-center text-xs font-semibold text-slate-400 whitespace-nowrap">Lot</TableHead>
              <TableHead className="w-[130px] text-xs font-semibold text-slate-400 whitespace-nowrap">최단 유효기간</TableHead>
              <TableHead className="w-[200px] text-center text-xs font-semibold text-slate-400 whitespace-nowrap">빠른 작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-[400px]">
                  <div className="flex flex-col items-center justify-center h-full">
                    <Package className="h-12 w-12 text-slate-200 text-slate-300 mb-4" />
                    <p className="text-muted-foreground mb-4">{emptyMessage}</p>
                    {emptyAction && (
                      <Button onClick={emptyAction} size="sm">{emptyActionLabel}</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedGroups.map((group) => {
                const isExpanded = expandedProducts.has(group.productId);
                const groupStatus = getGroupStatus(group);
                const expiryStatus = isExpired(group.earliestExpiry) ? "폐기" : isExpiringSoon(group.earliestExpiry) ? "임박" : null;
                const displayStatus = expiryStatus ?? groupStatus;
                const expiryDays = getExpiryDays(group.earliestExpiry);
                const isRisky = displayStatus === "부족" || displayStatus === "폐기" || displayStatus === "임박";

                return (
                  <Fragment key={group.productId}>
                    {/* ══════ 상위 품목 row ══════ */}
                    <TableRow
                      className={`cursor-pointer select-none transition-all duration-150 border-b border-slate-700${isExpanded
                          ? "bg-blue-50/60 bg-blue-950/20 hover:bg-blue-50/80 hover:bg-blue-950/30 shadow-none"
                          : isRisky
                          ? "bg-red-50/20 bg-red-950/5 hover:bg-red-50/40 hover:bg-red-950/10"
                          : "bg-slate-950 hover:bg-slate-900/50"
                        }
                      `}
                      onClick={() => toggleExpand(group.productId)}
                    >
                      {/* 확장 아이콘 */}
                      <TableCell className="px-2">
                        <div className={`
                          flex items-center justify-center h-7 w-7 rounded-md transition-all duration-200
                          ${isExpanded
                            ? "bg-blue-900/40 text-blue-400"
                            : "bg-slate-800 text-slate-400 text-slate-500 hover:bg-slate-700"
                          }
                        `}>
                          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        </div>
                      </TableCell>

                      {/* 상태 배지 */}
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={displayStatus} />
                      </TableCell>

                      {/* 품목 정보 */}
                      <TableCell>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100 truncate">
                              {group.productName}
                            </span>
                            {isExpanded && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-800 text-blue-400 bg-blue-950/30 shrink-0 animate-in fade-in-50 duration-200">
                                Lot {group.lotCount}개 표시 중
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate whitespace-nowrap">
                            {group.brand ?? "-"}
                            {group.catalogNumber && <> · Cat: {group.catalogNumber}</>}
                          </div>
                        </div>
                      </TableCell>

                      {/* 총 수량 */}
                      <TableCell className="text-right whitespace-nowrap">
                        <span className={`font-bold text-base${
                          groupStatus === "부족" ? "text-red-400" :
                          groupStatus === "주의" ? "text-orange-400" :
                          "text-slate-100"
                        }`}>
                          {group.totalQuantity}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">{group.unit}</span>
                        {group.safetyStock !== null && group.safetyStock > 0 && (
                          <div className="text-[10px] text-slate-400 text-slate-500 mt-0.5 whitespace-nowrap">
                            안전재고 {group.safetyStock}
                          </div>
                        )}
                      </TableCell>

                      {/* Lot 수 */}
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0${
                            isExpanded
                              ? "border-blue-800 text-blue-400 bg-blue-950/30"
                              : "border-slate-700"
                          }`}
                        >
                          {group.lotCount}개
                        </Badge>
                      </TableCell>

                      {/* 최단 유효기간 */}
                      <TableCell>
                        {group.earliestExpiry ? (
                          <div>
                            <span className={`text-xs font-medium${
                              isExpired(group.earliestExpiry) ? "text-red-400" :
                              isExpiringSoon(group.earliestExpiry) ? "text-amber-400" :
                              "text-slate-400"
                            }`}>
                              {format(new Date(group.earliestExpiry), "yyyy.MM.dd")}
                            </span>
                            {expiryDays !== null && expiryDays <= 30 && (
                              <span className={`text-[10px] ml-1 font-semibold ${
                                expiryDays <= 0 ? "text-red-500" : "text-amber-500"
                              }`}>
                                {expiryDays <= 0 ? "만료" : `D-${expiryDays}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* 빠른 작업 — 상태 기반 우선순위 */}
                      <TableCell className="text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          {(isRisky || groupStatus === "주의") ? (
                            /* ── 부족/주의/만료/임박 → 재발주(긴급) + 입고 ── */
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-7 px-2 text-[11px] gap-1${
                                        groupStatus === "부족" || displayStatus === "폐기"
                                          ? "text-red-400 border-red-800 hover:bg-red-950/30"
                                          : "text-orange-400 border-orange-800 hover:bg-orange-950/30"
                                      }`}
                                      onClick={() => onReorder(group.lots[0])}
                                    >
                                      <RotateCcw className="h-3 w-3 shrink-0" />
                                      재발주
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>재발주 요청</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              {onRestock && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[11px] gap-1 text-emerald-400 border-emerald-800 hover:bg-emerald-950/30"
                                        onClick={() => onRestock(group.lots[0])}
                                      >
                                        <PackagePlus className="h-3 w-3 shrink-0" />
                                        입고
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>입고 등록</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          ) : (
                            /* ── 정상 → 입고 + 재발주 (출고는 Lot에서만) ── */
                            <>
                              {onRestock && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[11px] gap-1 text-emerald-400 border-emerald-800 hover:bg-emerald-950/30"
                                        onClick={() => onRestock(group.lots[0])}
                                      >
                                        <PackagePlus className="h-3 w-3 shrink-0" />
                                        입고
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>입고 등록</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-[11px] gap-1 text-slate-400 border-slate-700 hover:bg-slate-800"
                                      onClick={() => onReorder(group.lots[0])}
                                    >
                                      <RotateCcw className="h-3 w-3 shrink-0" />
                                      재발주
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>재발주 요청</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                          {/* 더보기 — 보조/관리 기능 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-slate-400">
                                <MoreVertical className="h-3.5 w-3.5 shrink-0" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => onDetailClick?.(group.lots[0])} className="gap-2 text-xs">
                                <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                상세 보기
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onEdit(group.lots[0])} className="gap-2 text-xs">
                                <Pencil className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                정보 수정
                              </DropdownMenuItem>
                              {onPrintLabel && (
                                <DropdownMenuItem onClick={() => onPrintLabel(group.productName, group.lots)} className="gap-2 text-xs">
                                  <Printer className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                  라벨 인쇄
                                </DropdownMenuItem>
                              )}
                              {onDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => onDelete(group.lots[0])} className="gap-2 text-xs text-red-400 focus:text-red-400">
                                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                    삭제
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* ══════ 하위 Lot rows (expand) ══════ */}
                    {isExpanded && (
                      <>
                        {/* Lot 헤더 (하위 컬럼 안내) */}
                        <TableRow className="bg-slate-800/80 bg-slate-800/40 hover:bg-slate-800/80 hover:bg-slate-800/40 border-b border-slate-800/80 border-slate-700/50">
                          <TableCell className="px-2">
                            <div className="w-7" />
                          </TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">상태</TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">Lot 정보</TableCell>
                          <TableCell className="text-right text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">수량</TableCell>
                          <TableCell className="text-center text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">위치</TableCell>
                          <TableCell className="text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">유효기간</TableCell>
                          <TableCell className="text-center text-[10px] font-bold text-slate-400 text-slate-500 uppercase tracking-wider py-1.5">작업</TableCell>
                        </TableRow>

                        {group.lots.map((lot, lotIdx) => {
                          const lotStatus = getLotStatus(lot);
                          const lotExpired = isExpired(lot.expiryDate);
                          const lotExpiringSoon = isExpiringSoon(lot.expiryDate);
                          const lotDisplayStatus = lotExpired ? "폐기" : lotExpiringSoon ? "임박" : lotStatus;
                          const lotExpiryDays = getExpiryDays(lot.expiryDate);
                          const isLastLot = lotIdx === group.lots.length - 1;
                          const lotNeedsUrgent = lotDisplayStatus === "부족" || lotDisplayStatus === "폐기" || lotDisplayStatus === "임박" || lotStatus.startsWith("소진 임박") || lotStatus === "재주문 권장";

                          return (
                            <TableRow
                              key={lot.id}
                              className={`transition-colors duration-100 bg-slate-900/40 hover:bg-blue-950/20${isLastLot
                                  ? "border-b-2 border-blue-800"
                                  : "border-b border-dashed border-slate-800/80 border-slate-700/40"
                                }
                              `}
                            >
                              {/* 들여쓰기 + 연결선 */}
                              <TableCell className="px-2">
                                <div className="flex items-center justify-center">
                                  <div className={`h-4 w-4 ml-1.5 ${
                                    isLastLot ? "rounded-bl-lg" : ""} border-l-2 border-b-2 border-blue-700`} /> </div> </TableCell> {/* 상태 */} <TableCell className="whitespace-nowrap">
                                <StatusBadge status={lotDisplayStatus} />
                              </TableCell>

                              {/* Lot 정보 */}
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  <span className="font-mono font-semibold text-slate-300 whitespace-nowrap shrink-0">
                                    {lot.lotNumber || "Lot 미지정"}
                                  </span>
                                  <StorageConditionTag cond={lot.storageCondition} />
                                  {lot.inUseOrUnopened && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700 whitespace-nowrap shrink-0">
                                      {lot.inUseOrUnopened}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              {/* 수량 */}
                              <TableCell className="text-right whitespace-nowrap">
                                <span className="font-semibold text-slate-200">{lot.currentQuantity}</span>
                                <span className="text-xs text-slate-500 ml-1">{lot.unit}</span>
                              </TableCell>

                              {/* 위치 */}
                              <TableCell className="text-center">
                                {lot.location ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                    <span className="truncate max-w-[80px]">{lot.location}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-400 font-medium">미지정</span>
                                )}
                              </TableCell>

                              {/* 유효기간 */}
                              <TableCell>
                                {lot.expiryDate ? (
                                  <div>
                                    <span className={`text-xs font-medium${
                                      lotExpired ? "text-red-400 line-through" :
                                      lotExpiringSoon ? "text-amber-400" :
                                      "text-slate-400"
                                    }`}>
                                      {format(new Date(lot.expiryDate), "yyyy.MM.dd")}
                                    </span>
                                    {lotExpiryDays !== null && lotExpiryDays <= 30 && (
                                      <span className={`text-[10px] ml-1 font-semibold ${
                                        lotExpiryDays <= 0 ? "text-red-500" : "text-amber-500"
                                      }`}>
                                        {lotExpiryDays <= 0 ? "만료" : `D-${lotExpiryDays}`}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </TableCell>

                              {/* Lot 작업 — 출고/라벨/QR은 Lot에서만 */}
                              <TableCell className="text-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                                  {onConsume && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className={`h-7 px-2 text-[11px] gap-1${
                                              lotNeedsUrgent
                                                ? lotDisplayStatus === "부족" || lotDisplayStatus === "폐기"
                                                  ? "text-red-400 border-red-800 hover:bg-red-950/30"
                                                  : "text-orange-400 border-orange-800 hover:bg-orange-950/30"
                                                : "text-slate-400 border-slate-700 hover:bg-slate-800"
                                            }`}
                                            onClick={() => onConsume(lot)}
                                          >
                                            <Truck className="h-3 w-3 shrink-0" />
                                            출고
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>출고 / 사용 처리</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {onMoveLocation && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-[11px] gap-1 text-violet-400 border-violet-200 border-violet-800 hover:bg-violet-950/30"
                                            onClick={() => onMoveLocation(lot)}
                                          >
                                            <ArrowLeftRight className="h-3 w-3 shrink-0" />
                                            이동
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>위치 이동</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  {/* 더보기 — QR/라벨/상세/수정/폐기 */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-slate-400">
                                        <MoreVertical className="h-3.5 w-3.5 shrink-0" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem onClick={() => onDetailClick?.(lot)} className="gap-2 text-xs">
                                        <Eye className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                        상세 보기
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="gap-2 text-xs"
                                        onClick={() => {
                                          const url = `${window.location.origin}/dashboard/inventory/scan?id=${lot.id}`;
                                          navigator.clipboard.writeText(url);
                                        }}
                                      >
                                        <QrCode className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                        QR 링크 복사
                                      </DropdownMenuItem>
                                      {onPrintLabel && (
                                        <DropdownMenuItem onClick={() => onPrintLabel(lot.product.name, [lot])} className="gap-2 text-xs">
                                          <Printer className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                          라벨 인쇄
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => onEdit(lot)} className="gap-2 text-xs">
                                        <Pencil className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                        정보 수정
                                      </DropdownMenuItem>
                                      {onDelete && (
                                        <DropdownMenuItem onClick={() => onDelete(lot)} className="gap-2 text-xs text-red-400 focus:text-red-400">
                                          <PackageX className="h-3.5 w-3.5 shrink-0" />
                                          폐기 검토
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
