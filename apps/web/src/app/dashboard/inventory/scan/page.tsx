"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  QrCode,
  ArrowLeft,
  Camera,
  CameraOff,
  Package,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";

/**
 * /dashboard/inventory/scan
 * 1) URL에 ?id= 파라미터가 있으면 즉시 해당 재고 상세를 표시 (QR 스캔 착지 페이지)
 * 2) 파라미터가 없으면 카메라 스캐너를 띄워 직접 스캔
 */
function InventoryScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const inventoryId = searchParams.get("id");

  // ─── 카메라 스캐너 상태 ───────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const readerRef = useRef<any>(null);

  // ─── 재고 조회 (id가 있을 때) ────────────────────────────────────────
  const { data: inventoryData, isLoading: loadingInventory, error: inventoryError } = useQuery({
    queryKey: ["inventory-item", inventoryId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/${inventoryId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "재고를 찾을 수 없습니다.");
      }
      return res.json();
    },
    enabled: !!inventoryId && status === "authenticated",
    retry: false,
  });

  const inventory = inventoryData?.inventory;

  // ─── ZXing 스캐너 시작 ──────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setCameraError(null);
    setScanning(true);

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (devices.length === 0) {
        setCameraError("카메라를 찾을 수 없습니다.");
        setScanning(false);
        return;
      }

      // 후면 카메라 우선 선택 (모바일)
      const backCamera =
        devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];

      await reader.decodeFromVideoDevice(
        backCamera.deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            const text = result.getText();
            handleScannedText(text);
          }
        }
      );
    } catch (err: any) {
      console.error("카메라 초기화 오류:", err);
      if (err?.name === "NotAllowedError") {
        setCameraError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.");
      } else {
        setCameraError("카메라를 시작할 수 없습니다: " + (err?.message || "알 수 없는 오류"));
      }
      setScanning(false);
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setScanning(false);
  }, []);

  // ─── 스캔 결과 처리 ──────────────────────────────────────────────────
  const handleScannedText = useCallback((text: string) => {
    stopScanner();

    // URL 형식이면 id 파라미터 추출
    try {
      const url = new URL(text);
      const scannedId = url.searchParams.get("id");
      if (scannedId) {
        router.push(`/dashboard/inventory/scan?id=${scannedId}`);
        return;
      }
    } catch {
      // URL이 아닌 경우 — 텍스트 자체가 inventoryId라고 가정
    }

    // 텍스트 자체가 ID인 경우
    if (text.trim()) {
      router.push(`/dashboard/inventory/scan?id=${text.trim()}`);
    }
  }, [router, stopScanner]);

  // 수동 ID 입력
  const handleManualSearch = () => {
    const id = manualId.trim();
    if (!id) return;
    router.push(`/dashboard/inventory/scan?id=${id}`);
  };

  // 페이지 언마운트 시 카메라 정리
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // ─── 인증 대기 ───────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ─── 재고 ID가 있을 때 — 상세 뷰 ─────────────────────────────────────
  if (inventoryId) {
    return (
      <div className="min-h-screen bg-[#1a1a1e] p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* 헤더 */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/inventory")} className="gap-1 pl-0">
              <ArrowLeft className="h-4 w-4" />
              재고 목록
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <QrCode className="h-3.5 w-3.5" />
              QR 스캔 결과
            </div>
          </div>

          {/* 로딩 */}
          {loadingInventory && (
            <Card>
              <CardContent className="flex items-center justify-center py-12 gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                재고 정보를 불러오는 중...
              </CardContent>
            </Card>
          )}

          {/* 에러 */}
          {inventoryError && (
            <Card className="border-red-800 bg-red-900/20">
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <p className="font-semibold text-red-400">재고를 찾을 수 없습니다</p>
                <p className="text-xs text-red-500">ID: {inventoryId}</p>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/inventory/scan")}>
                  다시 스캔
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 재고 정보 카드 */}
          {inventory && (
            <>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base leading-tight">
                        {inventory.product?.name || inventory.name || "제품 정보 없음"}
                      </CardTitle>
                      {inventory.product?.catalogNumber && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Cat#: {inventory.product.catalogNumber}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        inventory.currentQuantity <= 0
                          ? "bg-red-100 text-red-700 border-red-200"
                          : inventory.safetyStock && inventory.currentQuantity <= inventory.safetyStock
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }
                    >
                      {inventory.currentQuantity <= 0
                        ? "재고 없음"
                        : inventory.safetyStock && inventory.currentQuantity <= inventory.safetyStock
                        ? "부족"
                        : "정상"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 핵심 수치 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-900/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        {inventory.currentQuantity}
                      </p>
                      <p className="text-xs text-blue-500">{inventory.unit || "개"} (현재)</p>
                    </div>
                    <div className="bg-[#222226] rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-300">
                        {inventory.safetyStock ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">안전 재고</p>
                    </div>
                  </div>

                  {/* 메타 정보 */}
                  <div className="space-y-2 text-sm">
                    {inventory.location && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{inventory.location}</span>
                      </div>
                    )}
                    {inventory.lotNumber && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Package className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Lot: {inventory.lotNumber}</span>
                      </div>
                    )}
                    {inventory.expiryDate && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          유효기한:{" "}
                          {new Date(inventory.expiryDate).toLocaleDateString("ko-KR")}
                          {new Date(inventory.expiryDate) < new Date() && (
                            <span className="ml-1 text-red-500 font-semibold">만료됨</span>
                          )}
                        </span>
                      </div>
                    )}
                    {inventory.notes && (
                      <p className="text-xs text-slate-500 bg-[#222226] rounded p-2 italic">
                        {inventory.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 빠른 액션 */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-12"
                  onClick={() => router.push(`/dashboard/inventory?restock=${inventory.id}`)}
                >
                  <Package className="h-4 w-4" />
                  입고 처리
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-12"
                  onClick={() => router.push(`/dashboard/inventory?detail=${inventory.id}`)}
                >
                  <Search className="h-4 w-4" />
                  상세 보기
                </Button>
              </div>

              {/* 다시 스캔 */}
              <Button
                variant="ghost"
                className="w-full gap-2 text-slate-500"
                onClick={() => router.push("/dashboard/inventory/scan")}
              >
                <QrCode className="h-4 w-4" />
                다른 QR 스캔
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── ID 없을 때 — 카메라 스캐너 뷰 ────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1a1a1e] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 p-4 text-white">
        <Link href="/dashboard/inventory">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 gap-1 pl-0">
            <ArrowLeft className="h-4 w-4" />
            재고 목록
          </Button>
        </Link>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium">QR 스캔</span>
        </div>
        <div className="w-20" />
      </div>

      {/* 카메라 뷰파인더 */}
      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 px-4">
        {/* 비디오 + 오버레이 */}
        <div className="relative w-full max-w-sm">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square shadow-2xl">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
              autoPlay
              playsInline
              muted
            />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/60">
                <CameraOff className="h-16 w-16" />
                <p className="text-sm">카메라가 꺼져 있습니다</p>
              </div>
            )}
            {/* 스캔 가이드 오버레이 */}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/70 rounded-xl relative">
                  {/* 모서리 강조 */}
                  <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
                  {/* 스캔 라인 애니메이션 */}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-blue-400/70 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 에러 메시지 */}
        {cameraError && (
          <div className="w-full max-w-sm bg-red-900/50 border border-red-700 rounded-xl p-3 text-red-300 text-sm text-center">
            {cameraError}
          </div>
        )}

        {/* 스캔 버튼 */}
        <div className="flex gap-3">
          {!scanning ? (
            <Button
              size="lg"
              onClick={startScanner}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl h-12"
            >
              <Camera className="h-5 w-5" />
              카메라 시작
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              onClick={stopScanner}
              className="gap-2 border-white/30 text-white hover:bg-white/10 px-8 rounded-xl h-12"
            >
              <CameraOff className="h-5 w-5" />
              중지
            </Button>
          )}
        </div>

        {/* 안내 텍스트 */}
        <p className="text-white/50 text-xs text-center max-w-xs">
          재고 라벨의 QR 코드를 카메라에 가져다 대세요.<br />
          자동으로 인식됩니다.
        </p>

        {/* 구분선 */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-white/40 text-xs">또는 ID 직접 입력</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {/* 수동 ID 입력 */}
        <div className="flex gap-2 w-full max-w-sm">
          <Input
            placeholder="재고 ID 또는 카탈로그 번호"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
          />
          <Button
            variant="outline"
            onClick={handleManualSearch}
            className="border-white/30 text-white hover:bg-white/10 rounded-xl px-4"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#1a1a1e]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <InventoryScanContent />
    </Suspense>
  );
}
