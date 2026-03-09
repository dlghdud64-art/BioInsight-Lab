"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Thermometer, Snowflake, Clock, Ban, Leaf, Infinity, PackagePlus, MoreVertical, Pencil, Eye, Trash2 } from "lucide-react";
import { InventoryQRCode } from "./InventoryQRCode";
import { format, addDays } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
  // 다중 Lot 지원: InventoryRestock 레코드
  restockRecords?: Array<{
    id: string;
    lotNumber: string | null;
    expiryDate: string | null;
    quantity: number;
  }>;
}

/**
 * 다중 Lot 중 가장 유통기한이 임박한 Lot을 대표로 선택하고 전체 Lot 수를 반환
 * FIFO 원칙: 유통기한이 가장 이른 것을 먼저 사용
 */
function getLotDisplay(inventory: InventoryItem): {
  representativeLotNumber: string | null;
  representativeExpiryDate: string | null;
  totalLotCount: number;
  /** 대표 Lot을 제외한 나머지 Lot 목록 (HoverCard 표시용) */
  otherLots: Array<{ lotNumber: string | null; expiryDate: string | null }>;
} {
  const now = new Date();

  // 초기 Lot (ProductInventory.lotNumber) + 입고 이력의 Lot 합산
  const candidates: Array<{ lotNumber: string | null; expiryDate: string | null }> = [];

  // 입고 이력에서 distinct lot 추출
  const restocks = inventory.restockRecords ?? [];
  const seenLots = new Set<string>();
  for (const r of restocks) {
    const key = r.lotNumber ?? "__no_lot__";
    if (!seenLots.has(key)) {
      seenLots.add(key);
      candidates.push({ lotNumber: r.lotNumber, expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString() : null });
    }
  }

  // 입고 이력이 없으면 ProductInventory의 초기 Lot 사용
  if (candidates.length === 0) {
    candidates.push({ lotNumber: inventory.lotNumber ?? null, expiryDate: inventory.expiryDate });
  }

  // 유통기한이 있는 것만 필터 후 가장 이른 날짜 우선 정렬 (null expiry는 후순위)
  candidates.sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  const representative = candidates[0] ?? { lotNumber: null, expiryDate: null };
  const validCandidates = candidates.filter(c => c.lotNumber !== null || c.expiryDate !== null);

  return {
    representativeLotNumber: representative.lotNumber,
    representativeExpiryDate: representative.expiryDate,
    totalLotCount: validCandidates.length,
    otherLots: validCandidates.slice(1),
  };
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
  const getStockStatus = (inventory: InventoryItem) => {
    const dailyUsage = inventory.averageDailyUsage ?? 0;
    const leadTime = inventory.leadTimeDays ?? 0;
    const currentStock = inventory.currentQuantity;

    // 리드 타임 기반 재주문 필요 판단: current_stock <= average_daily_usage * lead_time_days
    if (dailyUsage > 0 && leadTime > 0) {
      const reorderPoint = dailyUsage * leadTime;
      if (currentStock <= reorderPoint) {
        const daysUntilExhaustion = Math.floor(currentStock / dailyUsage);
        const exhaustionDate = addDays(new Date(), daysUntilExhaustion);
        const exhaustionDateStr = format(exhaustionDate, "yyyy-MM-dd");
        const label =
          daysUntilExhaustion <= 7
            ? `소진 임박 (D-${daysUntilExhaustion})`
            : "재주문 권장";
        return {
          label,
          exhaustionDate: exhaustionDateStr,
          daysUntilExhaustion,
          isReorderNeeded: true,
        };
      }
    }

    if (currentStock === 0) {
      return { label: "부족" as const };
    }
    if (inventory.safetyStock !== null && currentStock <= inventory.safetyStock) {
      return { label: "부족" as const };
    }
    if (inventory.safetyStock !== null && currentStock <= inventory.safetyStock * 1.5) {
      return { label: "주의" as const };
    }
    return { label: "정상" as const };
  };

  const renderStatusBadge = (status: string, tooltipText?: string) => {
    const wrapWithTooltip = (content: React.ReactNode) =>
      tooltipText ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-2 cursor-help">{content}</span>
            </TooltipTrigger>
            <TooltipContent className="antialiased">{tooltipText}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        content
      );

    const CircularBadge = ({
      children,
      className,
      label,
    }: {
      children: React.ReactNode;
      className: string;
      label: string;
    }) => (
      <span className="inline-flex items-center gap-2 antialiased">
        <span className={`${BADGE_SIZE} ${BADGE_BASE} ${className}`}>
          <span className={`flex items-center justify-center ${ICON_OFFSET}`}>{children}</span>
        </span>
        <span className="text-[11px] font-semibold">{label}</span>
      </span>
    );

    if (status.startsWith("소진 임박") || status === "재주문 권장") {
      const badge = (
        <CircularBadge
          className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
          label={status}
        >
          <Ban className="h-4 w-4" strokeWidth={2.25} />
        </CircularBadge>
      );
      return wrapWithTooltip(badge);
    }

    switch (status) {
      case "부족":
      case "out_of_stock":
      case "low":
        return (
          <CircularBadge
            className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"
            label="부족"
          >
            <Ban className="h-4 w-4" strokeWidth={2.25} />
          </CircularBadge>
        );
      case "주의":
      case "warning":
        return (
          <CircularBadge
            className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
            label="주의"
          >
            <AlertTriangle className="h-4 w-4" strokeWidth={2.25} />
          </CircularBadge>
        );
      case "정상":
      case "in_stock":
      case "normal":
        return (
          <CircularBadge
            className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400"
            label="정상"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </CircularBadge>
        );
      case "임박":
      case "expiring_soon":
        return (
          <CircularBadge
            className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
            label="임박"
          >
            <span className="flex items-center justify-center gap-px">
              <Clock className="h-3.5 w-3.5" strokeWidth={2.25} />
              <Leaf className="h-2 w-2 opacity-90" strokeWidth={2.5} />
            </span>
          </CircularBadge>
        );
      case "폐기":
        return (
          <CircularBadge
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            label="폐기"
          >
            <Infinity className="h-4 w-4" strokeWidth={2} />
          </CircularBadge>
        );
      default:
        return (
          <CircularBadge
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            label="알 수 없음"
          >
            <Infinity className="h-4 w-4" strokeWidth={2} />
          </CircularBadge>
        );
    }
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry.getTime() < today.getTime();
  };

  const minQty = (inv: InventoryItem) => inv.safetyStock ?? inv.minOrderQty ?? 0;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
      <div className="overflow-x-auto">
      <Table className="min-w-[700px]">
        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px] text-xs font-semibold text-slate-500 dark:text-slate-400">상태</TableHead>
            <TableHead className="min-w-[200px] text-xs font-semibold text-slate-500 dark:text-slate-400">품목 정보</TableHead>
            <TableHead className="w-[100px] text-xs font-semibold text-slate-500 dark:text-slate-400">Lot 및 유효기한</TableHead>
            <TableHead className="min-w-[145px] w-[145px] text-xs font-semibold text-slate-500 dark:text-slate-400">보존조건</TableHead>
            <TableHead className="w-[120px] text-right text-xs font-semibold text-slate-500 dark:text-slate-400">재고 현황</TableHead>
            <TableHead className="w-[100px] text-center text-xs font-semibold text-slate-500 dark:text-slate-400">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-[400px]">
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-muted-foreground mb-4">{emptyMessage}</p>
                  {emptyAction && (
                    <Button onClick={emptyAction} size="sm">
                      {emptyActionLabel}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            inventories.map((inventory, index) => {
              const status = getStockStatus(inventory);
              const isLowQuantity = inventory.currentQuantity <= minQty(inventory);
              const isSameProductAsPrevious =
                index > 0 && inventories[index - 1].productId === inventory.productId;
              const isSameProductAsNext =
                index < inventories.length - 1 && inventories[index + 1].productId === inventory.productId;
              // 다중 Lot: 가장 유통기한 임박한 Lot을 대표로
              const lotDisplay = getLotDisplay(inventory);
              const representativeExpiry = lotDisplay.representativeExpiryDate;
              const representativeExpirySoon = isExpiringSoon(representativeExpiry);
              const representativeExpired = isExpired(representativeExpiry);

              const statusLabel = representativeExpired ? "폐기" : representativeExpirySoon ? "임박" : status.label;
              const tooltipText =
                "exhaustionDate" in status && status.exhaustionDate
                  ? `현재 사용량 기준 ${status.exhaustionDate} 소진 예상`
                  : undefined;
              const rowIsExpirySoon = representativeExpirySoon && !representativeExpired;
              const handleRowClick = () => onDetailClick?.(inventory);

              return (
                <TableRow
                  key={inventory.id}
                  className={`transition-colors ${
                    isSameProductAsNext ? "border-b-0" : "border-b"
                  } ${isSameProductAsPrevious ? "bg-slate-50/50 dark:bg-slate-900/30" : ""} hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                    onDetailClick ? "cursor-pointer" : ""
                  }`}
                  onClick={onDetailClick ? handleRowClick : undefined}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEdit(inventory);
                  }}
                >
                  <TableCell>
                    <span className="text-xs whitespace-nowrap antialiased">
                      {renderStatusBadge(statusLabel, tooltipText)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] min-w-0">
                    {isSameProductAsPrevious ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 shrink-0 rounded-bl-md border-b-2 border-l-2 border-slate-300 dark:border-slate-600" />
                        <div>
                          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            동일 품목 (이전 배치)
                          </div>
                          {inventory.product.brand && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">
                              {inventory.product.brand}
                              {inventory.product.catalogNumber && ` • Cat: ${inventory.product.catalogNumber}`}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="min-w-0 overflow-hidden">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {inventory.product.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {inventory.product.brand ?? "-"}
                          {inventory.product.catalogNumber && ` • Cat: ${inventory.product.catalogNumber}`}
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        {lotDisplay.representativeLotNumber ?? "-"}
                      </span>
                      {/* 외 N개 HoverCard: Lot가 2개 이상일 때 나머지 Lot 팝업 표시 */}
                      {lotDisplay.totalLotCount > 1 && (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span className="inline-flex cursor-pointer items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                              외 {lotDisplay.totalLotCount - 1}개
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-64 p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                              전체 Lot 목록 ({lotDisplay.totalLotCount}개)
                            </p>
                            <ul className="space-y-1.5">
                              {/* 대표 Lot */}
                              <li className="flex items-start justify-between gap-2 text-xs rounded bg-blue-50 dark:bg-blue-900/30 px-2 py-1">
                                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                                  {lotDisplay.representativeLotNumber ?? "Lot 미지정"}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                                  {lotDisplay.representativeExpiryDate
                                    ? format(new Date(lotDisplay.representativeExpiryDate), "yyyy.MM.dd")
                                    : "-"}
                                </span>
                              </li>
                              {/* 나머지 Lot */}
                              {lotDisplay.otherLots.map((lot, i) => (
                                <li
                                  key={i}
                                  className="flex items-start justify-between gap-2 text-xs px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                  <span className="font-mono text-slate-700 dark:text-slate-300 shrink-0">
                                    {lot.lotNumber ?? "Lot 미지정"}
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400 shrink-0">
                                    {lot.expiryDate
                                      ? format(new Date(lot.expiryDate), "yyyy.MM.dd")
                                      : "-"}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-0.5 font-medium ${
                        rowIsExpirySoon ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"
                      } ${representativeExpired ? "text-red-600 dark:text-red-400" : ""}`}
                    >
                      {representativeExpiry
                        ? format(new Date(representativeExpiry), "yyyy.MM.dd")
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3">
                    {inventory.storageCondition ? (
                      (() => {
                        const cond = inventory.storageCondition;
                        const label = getStorageConditionLabel(cond);
                        const isFreezer = /freezer_20|deep_freezer_80|ln2/i.test(cond);
                        const isFridge = /fridge/i.test(cond);
                        const isRoom = /room_temp|room_temp_std/i.test(cond);
                        const Icon = isFreezer ? Snowflake : Thermometer;
                        const badgeClass = isFreezer
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : isFridge
                            ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
                        return (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap w-fit ${badgeClass}`}
                          >
                            <Icon className="w-3 h-3 shrink-0" />
                            <span>{label}</span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {inventory.currentQuantity}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                      {inventory.unit}
                    </span>
                    {minQty(inventory) > 0 && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        최소 {minQty(inventory)} 필요
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {onRestock && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30 font-semibold gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestock(inventory);
                          }}
                        >
                          <PackagePlus className="h-3 w-3" />
                          입고
                        </Button>
                      )}
                      {/* QR 라벨 인쇄 */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span onClick={(e) => e.stopPropagation()}>
                            <InventoryQRCode
                              inventoryId={inventory.id}
                              productName={inventory.product.name}
                              catalogNumber={inventory.product.catalogNumber}
                              location={inventory.location}
                              unit={inventory.unit}
                              currentQuantity={inventory.currentQuantity}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          QR 라벨 인쇄
                        </TooltipContent>
                      </Tooltip>

                      {/* ⋮ 더보기 드롭다운: 상세 보기 / 정보 수정 / 삭제 */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDetailClick?.(inventory); }}
                            className="gap-2 text-sm"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-500" />
                            상세 보기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onEdit(inventory); }}
                            className="gap-2 text-sm"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            정보 수정
                          </DropdownMenuItem>
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); onDelete(inventory); }}
                              className="gap-2 text-sm text-red-600 focus:text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              삭제
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }          )
        )}
      </TableBody>
      </Table>
      </div>
    </div>
  );
}

