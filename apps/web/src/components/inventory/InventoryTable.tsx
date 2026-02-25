"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, ShoppingCart, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  emptyMessage?: string;
  emptyAction?: () => void;
}

export function InventoryTable({ 
  inventories, 
  onEdit, 
  onDelete,
  onReorder,
  emptyMessage = "아직 등록된 재고가 없습니다. 첫 재고를 등록해보세요.",
  emptyAction
}: InventoryTableProps) {
  const getStockStatus = (inventory: InventoryItem) => {
    if (inventory.currentQuantity === 0) {
      return { label: "부족" as const };
    }
    if (inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock) {
      return { label: "부족" as const };
    }
    if (inventory.safetyStock !== null && inventory.currentQuantity <= inventory.safetyStock * 1.5) {
      return { label: "주의" as const };
    }
    return { label: "정상" as const };
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "부족":
      case "out_of_stock":
      case "low":
        return (
          <Badge
            variant="outline"
            dot="red"
            dotPulse
            className="bg-red-50 text-red-700 border-red-200"
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
            className="bg-amber-50 text-amber-700 border-amber-200"
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
            dot="emerald"
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            정상
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            dot="slate"
            className="bg-slate-100 text-slate-600 border-slate-200"
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

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">상태</TableHead>
            <TableHead className="min-w-[250px]">품목명</TableHead>
            <TableHead className="w-[180px]">위치</TableHead>
            <TableHead className="w-[120px]">재고량</TableHead>
            <TableHead className="w-[120px]">유통기한</TableHead>
            <TableHead className="w-[180px] text-right">관리</TableHead>
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
                      첫 재고 등록하기
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            inventories.map((inventory) => {
              const status = getStockStatus(inventory);
              const isLowQuantity = inventory.currentQuantity <= (inventory.safetyStock || 0);
              const expirySoon = isExpiringSoon(inventory.expiryDate);
              const expired = isExpired(inventory.expiryDate);

              return (
                <TableRow key={inventory.id} className="hover:bg-slate-50">
                  <TableCell>
                    <span className="text-xs whitespace-nowrap">
                      {renderStatusBadge(status.label)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-lg border flex-shrink-0">
                        <AvatarImage src={`/api/products/${inventory.productId}/image`} alt={inventory.product.name} />
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                          {inventory.product.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{inventory.product.name}</div>
                        {inventory.product.brand && (
                          <div className="text-xs text-muted-foreground">{inventory.product.brand}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {inventory.location || "미지정"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-medium ${isLowQuantity ? "text-red-600" : ""}`}>
                      {inventory.currentQuantity} {inventory.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    {inventory.expiryDate ? (
                      <span className={`text-sm ${expired ? "text-red-600" : expirySoon ? "text-orange-600" : "text-muted-foreground"}`}>
                        {format(new Date(inventory.expiryDate), "yyyy.MM.dd")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(inventory)}
                        className="h-8 w-8 p-0"
                        title="수정"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(inventory)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onReorder(inventory)}
                        className="h-8 w-8 p-0"
                        title="주문하기"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

