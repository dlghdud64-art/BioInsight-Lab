"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Thermometer, Snowflake, Ban, Leaf, Infinity, PackagePlus, MoreVertical, Pencil, Eye, Trash2, ChevronRight, ChevronDown, QrCode, Clock, Package, RotateCcw } from "lucide-react";
import { InventoryQRCode } from "./InventoryQRCode";
import { format, addDays } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const BADGE_SIZE = "h-8 w-8";
const BADGE_BASE = "inline-flex items-center justify-center rounded-full shadow-sm ring-2 ring-white/50 shrink-0";
const ICON_OFFSET = "-translate-y-[1.5px]";

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
    // 가장 빠른 유효기간 (null 제외)
    const expiries = lots
      .map((l) => l.expiryDate)
      .filter((d): d is string => d !== null && d !== undefined)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const earliestExpiry = expiries[0] ?? null;
    // safetyStock: 같은 품목의 lot 중 최대값 사용
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

interface InventoryTableProps {
  inventories: InventoryItem[];
  onEdit: (inventory: InventoryItem) => void;
  onDelete?: (inventory: InventoryItem) => void;
  onReorder: (inventory: InventoryItem) => void;
  onDetailClick?: (inventory: InventoryItem) => void;
  onRestock?: (inventory: InventoryItem) => void;
  emptyMessage?: string;
  emptyAction?: () => void;
  emptyActionLabel?: string;
}

export function InventoryTable({
  inventories,
  onEdit,
  onDelete,
  onReorder,
  onDetailClick,
  onRestock,
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

  const groups = groupByProduct(inventories);

  const getGroupStatus = (group: ProductGroup) => {
    if (group.totalQuantity === 0) return "부족";
    if (group.safetyStock !== null && group.totalQuantity <= group.safetyStock) return "부족";
    if (group.safetyStock !== null && group.totalQuantity <= group.safetyStock * 1.5) return "주의";
    return "정상";
  };

  const getLotStatus = (inv: InventoryItem) => {
    const dailyUsage = inv.averageDailyUsage ?? 0;
    const leadTime = inv.leadTimeDays ?? 0;
    if (dailyUsage > 0 && leadTime > 0 && inv.currentQuantity <= dailyUsage * leadTime) {
      const daysLeft = Math.floor(inv.currentQuantity / dailyUsage);
      return daysLeft <= 7 ? `소진 임박 (D-${daysLeft})` : "재주문 권장";
    }
    if (inv.currentQuantity === 0) return "부족";
    if (inv.safetyStock !== null && inv.currentQuantity <= inv.safetyStock) return "부족";
    return "정상";
  };

  const isExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const exp = new Date(d);
    const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    return days > 0 && days <= 30;
  };

  const isExpired = (d: string | null) => {
    if (!d) return false;
    return new Date(d).getTime() < Date.now();
  };

  const renderStatusBadge = (status: string) => {
    const CircularBadge = ({ children, className, label }: { children: React.ReactNode; className: string; label: string }) => (
      <span className="inline-flex items-center gap-1.5 antialiased">
        <span className={`h-6 w-6 ${BADGE_BASE} ${className}`}>
          <span className="flex items-center justify-center">{children}</span>
        </span>
        <span className="text-[11px] font-semibold">{label}</span>
      </span>
    );

    if (status.startsWith("소진 임박") || status === "재주문 권장") {
      return <CircularBadge className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400" label={status}><Ban className="h-3.5 w-3.5" strokeWidth={2.25} /></CircularBadge>;
    }
    if (status === "부족" || status === "out_of_stock" || status === "low") {
      return <CircularBadge className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400" label="부족"><Ban className="h-3.5 w-3.5" strokeWidth={2.25} /></CircularBadge>;
    }
    if (status === "주의" || status === "warning") {
      return <CircularBadge className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400" label="주의"><AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} /></CircularBadge>;
    }
    if (status === "임박") {
      return <CircularBadge className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400" label="임박"><Clock className="h-3.5 w-3.5" strokeWidth={2.25} /></CircularBadge>;
    }
    return <CircularBadge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400" label="정상"><span className="h-2 w-2 rounded-full bg-emerald-500" /></CircularBadge>;
  };

  const renderStorageCondition = (cond: string | null | undefined) => {
    if (!cond) return <span className="text-xs text-muted-foreground">-</span>;
    const label = getStorageConditionLabel(cond);
    const isFreezer = /freezer_20|deep_freezer_80|ln2/i.test(cond);
    const isFridge = /fridge/i.test(cond);
    const Icon = isFreezer ? Snowflake : Thermometer;
    const cls = isFreezer
      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
      : isFridge
        ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400"
        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>
        <Icon className="w-3 h-3 shrink-0" />
        {label}
      </span>
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
      <div className="w-full overflow-x-auto">
        <Table className="min-w-[700px]">
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px] text-xs font-semibold text-slate-500 dark:text-slate-400"></TableHead>
              <TableHead className="w-[80px] text-xs font-semibold text-slate-500 dark:text-slate-400">상태</TableHead>
              <TableHead className="min-w-[200px] text-xs font-semibold text-slate-500 dark:text-slate-400">품목 정보</TableHead>
              <TableHead className="w-[100px] text-right text-xs font-semibold text-slate-500 dark:text-slate-400">총 수량</TableHead>
              <TableHead className="w-[80px] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Lot 수</TableHead>
              <TableHead className="w-[120px] text-xs font-semibold text-slate-500 dark:text-slate-400">최단 유효기간</TableHead>
              <TableHead className="w-[80px] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-[400px]">
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-muted-foreground mb-4">{emptyMessage}</p>
                    {emptyAction && (
                      <Button onClick={emptyAction} size="sm">{emptyActionLabel}</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => {
                const isExpanded = expandedProducts.has(group.productId);
                const groupStatus = getGroupStatus(group);
                const expiryStatus = isExpired(group.earliestExpiry) ? "폐기" : isExpiringSoon(group.earliestExpiry) ? "임박" : null;
                const displayStatus = expiryStatus ?? groupStatus;

                return (
                  <>
                    {/* ── 품목 집계 row ── */}
                    <TableRow
                      key={group.productId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer border-b"
                      onClick={() => toggleExpand(group.productId)}
                    >
                      <TableCell className="px-2">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs whitespace-nowrap">{renderStatusBadge(displayStatus)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0 overflow-hidden">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">{group.productName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {group.brand ?? "-"}
                            {group.catalogNumber && ` · Cat: ${group.catalogNumber}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{group.totalQuantity}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{group.unit}</span>
                        {group.safetyStock !== null && group.safetyStock > 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">안전재고 {group.safetyStock}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 dark:border-slate-700">
                          {group.lotCount}개
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {group.earliestExpiry ? (
                          <span className={`text-xs font-medium ${isExpired(group.earliestExpiry) ? "text-red-600 dark:text-red-400" : isExpiringSoon(group.earliestExpiry) ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                            {format(new Date(group.earliestExpiry), "yyyy.MM.dd")}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => onDetailClick?.(group.lots[0])} className="gap-2 text-sm">
                              <Eye className="h-3.5 w-3.5 text-blue-500" />
                              상세 보기
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(group.lots[0])} className="gap-2 text-sm">
                              <Pencil className="h-3.5 w-3.5 text-slate-500" />
                              정보 수정
                            </DropdownMenuItem>
                            {onDelete && (
                              <DropdownMenuItem onClick={() => onDelete(group.lots[0])} className="gap-2 text-sm text-red-600 focus:text-red-600 dark:text-red-400">
                                <Trash2 className="h-3.5 w-3.5" />
                                삭제
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>

                    {/* ── Lot 상세 rows (expand) ── */}
                    {isExpanded && group.lots.map((lot) => {
                      const lotStatus = getLotStatus(lot);
                      const lotExpired = isExpired(lot.expiryDate);
                      const lotExpiringSoon = isExpiringSoon(lot.expiryDate);
                      const lotDisplayStatus = lotExpired ? "폐기" : lotExpiringSoon ? "임박" : lotStatus;

                      return (
                        <TableRow
                          key={lot.id}
                          className="bg-slate-50/70 dark:bg-slate-900/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 border-b border-dashed border-slate-200 dark:border-slate-800"
                        >
                          <TableCell className="px-2">
                            <div className="h-4 w-4 ml-1 rounded-bl-md border-b-2 border-l-2 border-slate-300 dark:border-slate-600" />
                          </TableCell>
                          <TableCell>
                            <span className="text-xs whitespace-nowrap">{renderStatusBadge(lotDisplayStatus)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                Lot: {lot.lotNumber || "미지정"}
                              </span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span>{lot.location || "위치 미지정"}</span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              {renderStorageCondition(lot.storageCondition)}
                              {lot.inUseOrUnopened && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-200 dark:border-slate-700">{lot.inUseOrUnopened}</Badge>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{lot.currentQuantity}</span>
                            <span className="text-xs text-slate-500 ml-1">{lot.unit}</span>
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            {lot.expiryDate ? (
                              <span className={`text-xs font-medium ${lotExpired ? "text-red-600 dark:text-red-400" : lotExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                                {format(new Date(lot.expiryDate), "yyyy.MM.dd")}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-0.5">
                              {/* QR (lot 단위) */}
                              <InventoryQRCode
                                inventoryId={lot.id}
                                productName={lot.product.name}
                                catalogNumber={lot.product.catalogNumber}
                                location={lot.location}
                                unit={lot.unit}
                                currentQuantity={lot.currentQuantity}
                                lotNumber={lot.lotNumber}
                                allLots={group.lots.map((l) => ({
                                  id: l.id,
                                  lotNumber: l.lotNumber ?? null,
                                  location: l.location,
                                  currentQuantity: l.currentQuantity,
                                  unit: l.unit,
                                }))}
                              />
                              {/* 입고/폐기/조정 드롭다운 */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  {onRestock && (
                                    <DropdownMenuItem onClick={() => onRestock(lot)} className="gap-2 text-xs">
                                      <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
                                      입고
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => onEdit(lot)} className="gap-2 text-xs">
                                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                    수량 조정
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDetailClick?.(lot)} className="gap-2 text-xs">
                                    <Eye className="h-3.5 w-3.5 text-blue-500" />
                                    상세
                                  </DropdownMenuItem>
                                  {onDelete && (
                                    <DropdownMenuItem onClick={() => onDelete(lot)} className="gap-2 text-xs text-red-600 focus:text-red-600">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      폐기
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
