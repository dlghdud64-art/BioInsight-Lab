"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, ShoppingCart, Trash2, AlertTriangle, Thermometer } from "lucide-react";
import { format, addDays } from "date-fns";
import { getStorageConditionLabel } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
}

interface InventoryTableProps {
  inventories: InventoryItem[];
  onEdit: (inventory: InventoryItem) => void;
  onDelete?: (inventory: InventoryItem) => void;
  onReorder: (inventory: InventoryItem) => void;
  onDetailClick?: (inventory: InventoryItem) => void;
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
    const badgeClass = "antialiased";
    const wrapWithTooltip = (content: React.ReactNode) =>
      tooltipText ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block cursor-help">{content}</span>
            </TooltipTrigger>
            <TooltipContent className="antialiased">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        content
      );

    // 소진 임박 (D-N) 또는 재주문 권장 (동적 라벨)
    if (status.startsWith("소진 임박") || status === "재주문 권장") {
      const badge = (
        <Badge
          variant="outline"
          dot="red"
          dotPulse={status.startsWith("소진 임박")}
          className={`${badgeClass} bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800`}
        >
          {status}
        </Badge>
      );
      return wrapWithTooltip(badge);
    }

    switch (status) {
      case "부족":
      case "out_of_stock":
      case "low":
        return (
          <Badge
            variant="outline"
            dot="red"
            dotPulse
            className={`${badgeClass} bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800`}
          >
            부족
          </Badge>
        );
      case "주의":
      case "warning":
        return (
          <Badge
            variant="outline"
            dot="amber"
            className={`${badgeClass} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800`}
          >
            주의
          </Badge>
        );
      case "정상":
      case "in_stock":
      case "normal":
        return (
          <Badge
            variant="outline"
            className={`${badgeClass} h-6 w-fit shrink-0 rounded-full border-emerald-200 bg-emerald-50 px-2.5 font-semibold text-emerald-700 text-[11px] tracking-wide dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            정상
          </Badge>
        );
      case "임박":
      case "expiring_soon":
        return (
          <Badge
            variant="outline"
            className={`${badgeClass} h-6 w-fit shrink-0 rounded-full border-amber-200 bg-amber-50 px-2.5 font-semibold text-amber-700 text-[11px] tracking-wide dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400`}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            임박
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            dot="slate"
            className={`${badgeClass} bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400`}
          >
            알 수 없음
          </Badge>
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
            <TableHead className="w-[120px] text-xs font-semibold text-slate-500 dark:text-slate-400">Lot 및 유효기한</TableHead>
            <TableHead className="w-[120px] text-xs font-semibold text-slate-500 dark:text-slate-400">보관조건</TableHead>
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
              const expirySoon = isExpiringSoon(inventory.expiryDate);
              const expired = isExpired(inventory.expiryDate);
              const isSameProductAsPrevious =
                index > 0 && inventories[index - 1].productId === inventory.productId;
              const isSameProductAsNext =
                index < inventories.length - 1 && inventories[index + 1].productId === inventory.productId;
              const statusLabel =
                expirySoon && !expired ? "임박" : status.label;
              const tooltipText =
                "exhaustionDate" in status && status.exhaustionDate
                  ? `현재 사용량 기준 ${status.exhaustionDate} 소진 예상`
                  : undefined;
              const rowIsExpirySoon = expirySoon && !expired;
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
                    <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                      {inventory.lotNumber ?? "-"}
                    </div>
                    <div
                      className={`text-xs mt-0.5 font-medium ${
                        rowIsExpirySoon || expired ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"
                      } ${expired ? "text-red-600 dark:text-red-400" : ""}`}
                    >
                      {inventory.expiryDate
                        ? format(new Date(inventory.expiryDate), "yyyy.MM.dd")
                        : "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {inventory.storageCondition ? (
                      <Badge
                        variant="secondary"
                        className="h-6 rounded-full border-0 bg-slate-100 text-slate-600 font-normal hover:bg-slate-200 text-xs dark:bg-slate-800 dark:text-slate-400"
                      >
                        <Thermometer className="w-3 h-3 mr-1 shrink-0" />
                        {getStorageConditionLabel(inventory.storageCondition)}
                      </Badge>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 dark:text-blue-400 font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetailClick?.(inventory);
                      }}
                    >
                      상세 보기
                    </Button>
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

