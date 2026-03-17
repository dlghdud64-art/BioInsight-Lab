"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck } from "lucide-react";

interface LotInfo {
  id: string;
  lotNumber?: string | null;
  currentQuantity: number;
  unit: string;
  location?: string | null;
  product: { id: string; name: string; brand: string | null; catalogNumber: string | null };
}

interface DispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: LotInfo | null;
  allLots: LotInfo[];
  onSubmit: (data: {
    inventoryId: string;
    type: "DISPATCH";
    quantity: number;
    lotNumber?: string;
    operator?: string;
    notes?: string;
  }) => void;
  isLoading?: boolean;
  defaultOperator?: string;
}

export function DispatchDialog({
  open,
  onOpenChange,
  inventory,
  allLots,
  onSubmit,
  isLoading,
  defaultOperator,
}: DispatchDialogProps) {
  const [selectedLotId, setSelectedLotId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [operator, setOperator] = useState("");
  const [notes, setNotes] = useState("");

  const selectedLot = allLots.find((l) => l.id === selectedLotId) || inventory;

  useEffect(() => {
    if (open && inventory) {
      setSelectedLotId(inventory.id);
      setQuantity("");
      setOperator(defaultOperator || "");
      setNotes("");
    }
  }, [open, inventory, defaultOperator]);

  const handleSubmit = () => {
    if (!selectedLot || !quantity) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    onSubmit({
      inventoryId: selectedLot.id,
      type: "DISPATCH",
      quantity: qty,
      lotNumber: selectedLot.lotNumber || undefined,
      operator: operator.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  if (!inventory) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-slate-400" />
            출고 처리
          </DialogTitle>
          <DialogDescription className="text-xs">
            {inventory.product.name}
            {inventory.product.brand && ` · ${inventory.product.brand}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Lot 선택 */}
          {allLots.length > 1 && (
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium">Lot 선택</Label>
              <Select value={selectedLotId} onValueChange={setSelectedLotId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Lot 선택" />
                </SelectTrigger>
                <SelectContent>
                  {allLots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id} className="text-xs">
                      {lot.lotNumber || "Lot 미지정"} — {lot.currentQuantity} {lot.unit}
                      {lot.location && ` (${lot.location})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 출고 수량 */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">출고 수량</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="h-9 text-sm"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0">
                / 현재 {selectedLot?.currentQuantity ?? 0} {selectedLot?.unit}
              </span>
            </div>
            {quantity && parseFloat(quantity) > (selectedLot?.currentQuantity ?? 0) && (
              <p className="text-[11px] text-amber-400">현재 재고보다 많습니다. 음수 재고가 됩니다.</p>
            )}
          </div>

          {/* 담당자 */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">담당자</Label>
            <Input
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="출고 담당자"
              className="h-9 text-sm"
            />
          </div>

          {/* 메모 */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium">메모</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="출고 사유, 수령처 등"
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            취소
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!quantity || parseFloat(quantity) <= 0 || isLoading}
            className="text-xs gap-1.5 bg-slate-800 hover:bg-slate-900 text-white"
          >
            <Truck className="h-3 w-3" />
            {isLoading ? "처리 중..." : "출고 완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
