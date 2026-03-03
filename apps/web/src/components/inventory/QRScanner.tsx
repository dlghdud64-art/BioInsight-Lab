"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  Loader2,
  AlertTriangle,
  QrCode,
  RotateCcw,
} from "lucide-react";

type ScannerState = "idle" | "requesting" | "scanning" | "paused" | "error";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  /** 외부에서 스캐너 일시정지/재개 제어 */
  paused?: boolean;
  className?: string;
}

const SCANNER_ELEMENT_ID = "bio-qr-scanner-container";

/**
 * QRScanner — html5-qrcode 기반 카메라 QR 스캐너 컴포넌트
 *
 * - 모바일: 후면 카메라(environment) 기본 활성화
 * - 카메라 권한 거부 시 명확한 에러 UI
 * - 외부 QR / 유효하지 않은 QR은 onScanError로 전달 (스캐너 재개)
 */
export function QRScanner({
  onScanSuccess,
  onScanError,
  paused = false,
  className = "",
}: QRScannerProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, []);

  // 외부 paused prop 변화 처리
  useEffect(() => {
    if (paused && state === "scanning") {
      pauseScanner();
    } else if (!paused && state === "paused") {
      resumeScanner();
    }
  }, [paused]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
  }, []);

  const pauseScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        scannerRef.current.pause(true); // keepLastFrame=true
        setState("paused");
      } catch { /* ignore */ }
    }
  }, []);

  const resumeScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
        setState("scanning");
      } catch { /* ignore */ }
    }
  }, []);

  const startScanner = useCallback(async () => {
    setErrorMsg(null);
    setState("requesting");

    try {
      // 동적 import — SSR 안전
      const { Html5Qrcode } = await import("html5-qrcode");

      // 이전 인스턴스 정리
      await stopScanner();

      const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = html5QrCode;

      // 후면 카메라 우선 (모바일 대응)
      const facingMode = { exact: "environment" };

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      };

      try {
        await html5QrCode.start(
          { facingMode },
          config,
          (decodedText) => {
            if (mountedRef.current) onScanSuccess(decodedText);
          },
          () => { /* qr not found, silent */ }
        );
      } catch {
        // 후면 카메라 실패 시 기본 카메라로 재시도
        await html5QrCode.start(
          { facingMode: "user" },
          config,
          (decodedText) => {
            if (mountedRef.current) onScanSuccess(decodedText);
          },
          () => {}
        );
      }

      if (mountedRef.current) setState("scanning");
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("QR Scanner error:", err);

      let msg = "카메라를 시작할 수 없습니다.";
      if (
        err?.name === "NotAllowedError" ||
        err?.message?.includes("Permission") ||
        err?.message?.includes("permission")
      ) {
        msg = "카메라 권한이 필요합니다. 브라우저 주소창 왼쪽의 자물쇠 아이콘을 눌러 카메라를 허용해주세요.";
      } else if (err?.name === "NotFoundError") {
        msg = "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인하세요.";
      } else if (err?.name === "NotReadableError") {
        msg = "카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료한 후 다시 시도하세요.";
      }

      setErrorMsg(msg);
      setState("error");
      onScanError?.(msg);
      await stopScanner();
    }
  }, [onScanSuccess, onScanError, stopScanner]);

  const handleReset = useCallback(async () => {
    await stopScanner();
    setState("idle");
    setErrorMsg(null);
  }, [stopScanner]);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* 뷰파인더 영역 */}
      <div className="relative w-full max-w-sm">
        {/* html5-qrcode 마운트 포인트 */}
        <div
          id={SCANNER_ELEMENT_ID}
          className={`w-full rounded-2xl overflow-hidden bg-black aspect-square ${
            state === "scanning" || state === "paused" ? "block" : "hidden"
          }`}
          style={{ minHeight: 280 }}
        />

        {/* 스캔 중일 때 오버레이 가이드 */}
        {state === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-2xl overflow-hidden">
            <div className="relative w-56 h-56">
              {/* 모서리 마커 */}
              {(["tl", "tr", "bl", "br"] as const).map((pos) => (
                <div
                  key={pos}
                  className={`absolute w-7 h-7 border-4 border-blue-400
                    ${pos === "tl" ? "top-0 left-0 border-r-0 border-b-0 rounded-tl-lg" : ""}
                    ${pos === "tr" ? "top-0 right-0 border-l-0 border-b-0 rounded-tr-lg" : ""}
                    ${pos === "bl" ? "bottom-0 left-0 border-r-0 border-t-0 rounded-bl-lg" : ""}
                    ${pos === "br" ? "bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg" : ""}
                  `}
                />
              ))}
              {/* 스캔 라인 */}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-blue-400/80 animate-pulse rounded-full" />
            </div>
          </div>
        )}

        {/* idle 상태 플레이스홀더 */}
        {(state === "idle" || state === "requesting") && (
          <div className="w-full aspect-square bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-4 text-white/60">
            {state === "requesting" ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                <p className="text-sm">카메라 권한 요청 중...</p>
              </>
            ) : (
              <>
                <QrCode className="h-16 w-16 opacity-40" />
                <p className="text-sm">카메라가 꺼져 있습니다</p>
              </>
            )}
          </div>
        )}

        {/* 에러 상태 */}
        {state === "error" && (
          <div className="w-full aspect-square bg-red-950/80 rounded-2xl flex flex-col items-center justify-center gap-4 p-6 text-center border border-red-800">
            <AlertTriangle className="h-12 w-12 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300 leading-relaxed">{errorMsg}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="border-red-700 text-red-300 hover:bg-red-900/50 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              다시 시도
            </Button>
          </div>
        )}
      </div>

      {/* 컨트롤 버튼 */}
      <div className="flex gap-3">
        {state === "idle" || state === "error" ? (
          <Button
            size="lg"
            onClick={startScanner}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-xl h-12"
          >
            <Camera className="h-5 w-5" />
            카메라 시작
          </Button>
        ) : state === "requesting" ? (
          <Button size="lg" disabled className="px-8 rounded-xl h-12 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            권한 요청 중...
          </Button>
        ) : (
          <Button
            size="lg"
            variant="outline"
            onClick={handleReset}
            className="gap-2 border-white/30 text-white hover:bg-white/10 px-8 rounded-xl h-12"
          >
            <CameraOff className="h-5 w-5" />
            중지
          </Button>
        )}
      </div>

      {/* 안내 */}
      {state === "scanning" && (
        <p className="text-white/50 text-xs text-center max-w-xs">
          재고 라벨의 QR 코드를 가이드 박스 안에 맞춰주세요
        </p>
      )}
    </div>
  );
}
