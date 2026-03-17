"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useQRScanner } from "@/contexts/QRScannerContext";
import { QRScanner } from "./QRScanner";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Package,
  MapPin,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Minus,
  RotateCcw,
  ExternalLink,
  Calendar,
  Thermometer,
} from "lucide-react";
import { getStorageConditionLabel } from "@/lib/constants";

type ModalState = "scanner" | "loading" | "result" | "use-confirm";

interface InventoryResult {
  id: string;
  currentQuantity: number;
  unit: string | null;
  safetyStock: number | null;
  location: string | null;
  expiryDate: string | null;
  lotNumber: string | null;
  notes: string | null;
  product: {
    name: string;
    brand: string | null;
    catalogNumber: string | null;
    storageCondition: string | null;
    msdsUrl: string | null;
  };
}

function ScannerContent() {
  const { close } = useQRScanner();
  const router = useRouter();
  const { toast } = useToast();

  const [modalState, setModalState] = useState<ModalState>("scanner");
  const [scannerPaused, setScannerPaused] = useState(false);
  const [inventoryResult, setInventoryResult] = useState<InventoryResult | null>(null);
  const [useQty, setUseQty] = useState("1");
  const [useNotes, setUseNotes] = useState("");
  // 직접 입력 전환 시 포커스 대상
  const manualInputRef = useRef<HTMLInputElement>(null);

  // 재고 조회
  const fetchInventory = useCallback(async (id: string) => {
    setModalState("loading");
    setScannerPaused(true);

    try {
      const res = await fetch(`/api/inventory/scan?id=${encodeURIComponent(id)}`);
      const data = await res.json();

      if (!res.ok) {
        // 유효하지 않은 QR
        toast({
          title: "등록되지 않거나 유효하지 않은 QR 코드입니다.",
          description: data.error || "시스템에 등록된 재고 QR인지 확인하세요.",
          variant: "destructive",
        });
        // 스캐너 재개
        setModalState("scanner");
        setScannerPaused(false);
        return;
      }

      setInventoryResult(data.inventory);
      setModalState("result");
    } catch {
      toast({
        title: "네트워크 오류",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      setModalState("scanner");
      setScannerPaused(false);
    }
  }, [toast]);

  // 스캔 성공 핸들러
  const handleScanSuccess = useCallback((text: string) => {
    // URL 형식이면 id 파라미터 추출
    let id = text.trim();
    try {
      const url = new URL(text);
      const paramId = url.searchParams.get("id");
      if (paramId) id = paramId;
    } catch { /* 순수 ID */ }

    fetchInventory(id);
  }, [fetchInventory]);

  const handleScanError = useCallback((_error: string) => {
    // QRScanner가 이미 에러 UI를 보여주므로 추가 처리 없음
  }, []);

  /** 카메라 에러 시 직접 입력 필드로 스크롤 + 포커스 */
  const handleSwitchToManual = useCallback(() => {
    setTimeout(() => {
      manualInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      manualInputRef.current?.focus();
    }, 100);
  }, []);

  // 차감 처리 mutation
  const useMutation_ = useMutation({
    mutationFn: async () => {
      if (!inventoryResult) throw new Error("재고 정보 없음");
      const qty = parseFloat(useQty);
      if (isNaN(qty) || qty <= 0) throw new Error("올바른 수량을 입력하세요.");

      const res = await fetch(`/api/inventory/${inventoryResult.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: qty,
          unit: inventoryResult.unit ?? undefined,
          notes: useNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "차감 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "사용 처리 완료",
        description: `${useQty}${inventoryResult?.unit || "개"} 차감 → 잔여: ${data.updatedQuantity}${inventoryResult?.unit || "개"}${data.warning ? ` ⚠️ ${data.warning}` : ""}`,
      });
      // 결과 갱신
      if (inventoryResult) {
        setInventoryResult({ ...inventoryResult, currentQuantity: data.updatedQuantity });
      }
      setModalState("result");
      setUseQty("1");
      setUseNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "차감 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = useCallback(() => {
    setModalState("scanner");
    setScannerPaused(false);
    setInventoryResult(null);
    setUseQty("1");
    setUseNotes("");
    close();
  }, [close]);

  const handleRescan = useCallback(() => {
    setInventoryResult(null);
    setUseQty("1");
    setUseNotes("");
    setModalState("scanner");
    setScannerPaused(false);
  }, []);

  const isExpired = inventoryResult?.expiryDate
    ? new Date(inventoryResult.expiryDate) < new Date()
    : false;
  const isLow = inventoryResult
    ? inventoryResult.currentQuantity <= (inventoryResult.safetyStock ?? 0)
    : false;

  // ─── Scanner 뷰 ───────────────────────────────────────────────────────
  if (modalState === "scanner" || modalState === "loading") {
    return (
      <div className="flex flex-col gap-4 pt-2 pb-4 px-2">
        {modalState === "loading" ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm">재고 정보를 불러오는 중...</p>
          </div>
        ) : (
          <QRScanner
            onScanSuccess={handleScanSuccess}
            onScanError={handleScanError}
            paused={scannerPaused}
            onSwitchToManual={handleSwitchToManual}
            className="w-full"
          />
        )}

        {/* 구분선 + 수동 입력 */}
        {modalState === "scanner" && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-400">또는 직접 검색</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const id = (fd.get("manualId") as string)?.trim();
                if (id) fetchInventory(id);
              }}
            >
              <Input
                ref={manualInputRef}
                name="manualId"
                placeholder="재고 ID 입력..."
                className="flex-1"
              />
              <Button type="submit" size="sm">조회</Button>
            </form>
          </>
        )}
      </div>
    );
  }

  // ─── 차감 확인 뷰 ─────────────────────────────────────────────────────
  if (modalState === "use-confirm" && inventoryResult) {
    return (
      <div className="flex flex-col gap-5 py-2 px-2">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="font-semibold text-slate-200 text-sm">
            {inventoryResult.product.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            현재 재고: <span className="font-bold text-blue-400">{inventoryResult.currentQuantity}</span>{" "}
            {inventoryResult.unit || "개"}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              사용 수량 *
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setUseQty((v) => String(Math.max(0.1, parseFloat(v) - 1)))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={useQty}
                onChange={(e) => setUseQty(e.target.value)}
                className="text-center font-bold text-lg h-9 w-24"
              />
              <span className="text-sm text-slate-500">{inventoryResult.unit || "개"}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">
              메모 (선택)
            </label>
            <Input
              placeholder="실험명, 사용 목적 등..."
              value={useNotes}
              onChange={(e) => setUseNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setModalState("result")}
          >
            취소
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
            onClick={() => useMutation_.mutate()}
            disabled={useMutation_.isPending}
          >
            {useMutation_.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            {useMutation_.isPending ? "처리 중..." : "차감 확정"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── 결과 뷰 ────────────────────────────────────────────────────────────
  if (modalState === "result" && inventoryResult) {
    return (
      <div className="flex flex-col gap-4 py-2 px-2">
        {/* 상단 상태 배지 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={
              inventoryResult.currentQuantity <= 0
                ? "bg-red-900/40 text-red-700 border-red-800"
                : isLow
                ? "bg-amber-900/40 text-amber-700 border-amber-800"
                : "bg-emerald-900/40 text-emerald-700 border-emerald-800"
            }
          >
            {inventoryResult.currentQuantity <= 0 ? "재고 없음" : isLow ? "재고 부족" : "정상"}
          </Badge>
          {isExpired && (
            <Badge className="bg-red-900/40 text-red-700 border-red-800">유효기한 만료</Badge>
          )}
        </div>

        {/* 제품 기본 정보 */}
        <div>
          <h3 className="font-bold text-slate-100 text-base leading-snug">
            {inventoryResult.product.name}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {inventoryResult.product.brand && `${inventoryResult.product.brand} · `}
            {inventoryResult.product.catalogNumber && `Cat# ${inventoryResult.product.catalogNumber}`}
          </p>
        </div>

        {/* 수치 하이라이트 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {inventoryResult.currentQuantity}
            </p>
            <p className="text-xs text-blue-500">
              {inventoryResult.unit || "개"} 남음
            </p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-slate-300">
              {inventoryResult.safetyStock ?? "—"}
            </p>
            <p className="text-xs text-slate-500">안전 재고</p>
          </div>
        </div>

        {/* 메타 정보 */}
        <div className="space-y-2 text-sm">
          {inventoryResult.location && (
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span>{inventoryResult.location}</span>
            </div>
          )}
          {inventoryResult.lotNumber && (
            <div className="flex items-center gap-2 text-slate-400">
              <Package className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span className="font-mono">Lot: {inventoryResult.lotNumber}</span>
            </div>
          )}
          {inventoryResult.expiryDate && (
            <div className={`flex items-center gap-2 ${isExpired ? "text-red-400" : "text-slate-400"}`}>
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                유효기한: {new Date(inventoryResult.expiryDate).toLocaleDateString("ko-KR")}
                {isExpired && <span className="ml-1 font-semibold">⚠️ 만료</span>}
              </span>
            </div>
          )}
          {inventoryResult.product.storageCondition && (
            <div className="flex items-center gap-2 text-slate-400">
              <Thermometer className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
              <span>{getStorageConditionLabel(inventoryResult.product.storageCondition)}</span>
            </div>
          )}
          {inventoryResult.product.msdsUrl && (
            <a
              href={inventoryResult.product.msdsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              MSDS/SDS 문서 보기
            </a>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white h-11"
            onClick={() => setModalState("use-confirm")}
          >
            <Minus className="h-4 w-4" />
            사용(차감) 처리
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 h-11"
            onClick={() => {
              handleClose();
              router.push(`/dashboard/inventory?detail=${inventoryResult.id}`);
            }}
          >
            <ArrowRight className="h-4 w-4" />
            상세 정보 보기
          </Button>
          <Button
            variant="ghost"
            className="w-full gap-2 text-slate-500 h-9"
            onClick={handleRescan}
          >
            <RotateCcw className="h-4 w-4" />
            다른 QR 스캔
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * GlobalQRScannerModal
 * - 모바일(md 미만): Sheet side="bottom"
 * - 데스크톱(md 이상): Dialog
 */
export function GlobalQRScannerModal() {
  const { isOpen, close } = useQRScanner();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-blue-400" />
              재고 QR 스캔
            </SheetTitle>
          </SheetHeader>
          <ScannerContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="h-4 w-4 text-blue-400" />
            재고 QR 스캔
          </DialogTitle>
        </DialogHeader>
        <ScannerContent />
      </DialogContent>
    </Dialog>
  );
}
