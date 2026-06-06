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
  Keyboard,
} from "lucide-react";
// §11.374 — 인앱 스캔 공통 가이드 프레임(라벨/QR 통일)
import { ScanGuideFrame } from "./ScanGuideFrame";

type ScannerState = "idle" | "requesting" | "scanning" | "error";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  /** 외부에서 스캐너 일시정지/재개 제어 */
  paused?: boolean;
  /** 카메라 에러 시 "직접 입력으로 전환" 버튼 클릭 핸들러 */
  onSwitchToManual?: () => void;
  className?: string;
}

/**
 * QRScanner — nimiq/qr-scanner 기반 카메라 QR 스캐너 (§11.373-web-QR-replace)
 *
 * html5-qrcode → qr-scanner 교체. 핵심: <video> 를 **우리가 직접 렌더**(autoPlay·playsInline·muted)
 *   하고 라이브러리에 넘긴다 → §11.373c LabelScanner 와 동일하게 iOS Safari 첫 프레임 렌더 보장.
 *   (html5-qrcode 는 내부에서 video 를 만들어 autoplay 미설정 → start 후 동적 주입(§11.373d)으로도
 *    iOS 검은화면 해소 실패 → 라이브러리 교체.)
 *
 * - 후면 카메라(preferredCamera "environment")
 * - returnDetailedScanResult → result.data
 * - 언마운트/정지 시 destroy() 로 stream·worker 정리(Black Screen·점유 방지)
 * - startingRef in-flight 직렬화(연타·재오픈 중첩 방지, §11.373 보존)
 */
export function QRScanner({
  onScanSuccess,
  onScanError,
  paused = false,
  onSwitchToManual,
  className = "",
}: QRScannerProps) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  // §11.373 — start in-flight 직렬화(연타·재오픈 중첩 race 방지).
  const startingRef = useRef(false);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    // §11.373 — in-flight 가드: 진행 중이면 중복 start 차단.
    if (startingRef.current) return;
    startingRef.current = true;
    setErrorMsg(null);
    setIsPermissionError(false);
    setState("requesting");

    try {
      // 동적 import — SSR 안전(worker 포함 클라이언트 전용)
      const QrScanner = (await import("qr-scanner")).default;

      // 이전 인스턴스 완전 정리
      stopScanner();
      if (!mountedRef.current || !videoRef.current) return;

      const scanner = new QrScanner(
        videoRef.current,
        (result: { data: string }) => {
          if (mountedRef.current) onScanSuccess(result.data);
        },
        {
          preferredCamera: "environment",
          returnDetailedScanResult: true,
          // 가이드 프레임은 ScanGuideFrame 오버레이를 쓰므로 라이브러리 하이라이트는 끔.
          highlightScanRegion: false,
          highlightCodeOutline: false,
          onDecodeError: () => {
            /* QR 미감지 프레임 — silent */
          },
        }
      );
      scannerRef.current = scanner;

      await scanner.start();
      if (!mountedRef.current) return;
      setState("scanning");
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("QR Scanner error:", err);

      let msg = "카메라를 시작할 수 없습니다.";
      let isPermErr = false;

      const name = err?.name ?? "";
      const text = String(err?.message ?? err ?? "");
      if (name === "NotAllowedError" || /permission/i.test(text)) {
        msg =
          "카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해 주세요.";
        isPermErr = true;
      } else if (name === "NotFoundError" || /no camera|not found/i.test(text)) {
        msg = "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인하세요.";
      } else if (name === "NotReadableError" || /in use|read/i.test(text)) {
        msg =
          "카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료한 후 다시 시도하세요.";
      }

      setErrorMsg(msg);
      setIsPermissionError(isPermErr);
      setState("error");
      onScanError?.(msg);
      stopScanner();
    } finally {
      startingRef.current = false;
    }
  }, [onScanSuccess, onScanError, stopScanner]);

  // 외부 paused prop 변화 처리(stop/start)
  useEffect(() => {
    if (!scannerRef.current) return;
    if (paused) {
      try {
        scannerRef.current.stop();
      } catch {
        /* ignore */
      }
    } else if (state === "scanning") {
      scannerRef.current.start().catch(() => {
        /* ignore */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const handleReset = useCallback(() => {
    stopScanner();
    setState("idle");
    setErrorMsg(null);
    setIsPermissionError(false);
  }, [stopScanner]);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* 뷰파인더 영역 */}
      <div className="relative w-full max-w-sm">
        {/* §11.373-web-QR-replace — video 를 직접 렌더(autoPlay·playsInline·muted)해 qr-scanner 에 넘김.
            iOS Safari 첫 프레임 렌더 보장(§11.373c 동일 근본). transform-gpu 로 합성 승격. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full rounded-2xl overflow-hidden bg-black aspect-square object-cover transform-gpu ${
            state === "scanning" ? "block" : "hidden"
          }`}
          style={{ minHeight: 280 }}
        />

        {/* 스캔 중일 때 오버레이 가이드 — §11.374 공통 프레임(QR=스캔라인 포함) */}
        {state === "scanning" && (
          <ScanGuideFrame showScanLine className="rounded-2xl overflow-hidden" />
        )}

        {/* idle / requesting 상태 플레이스홀더 */}
        {(state === "idle" || state === "requesting") && (
          <div className="w-full aspect-square bg-pn rounded-2xl flex flex-col items-center justify-center gap-4 text-white/60">
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
            <div className="flex flex-col gap-2 w-full">
              <Button
                size="sm"
                variant="outline"
                onClick={startScanner}
                className="border-red-700 text-red-300 hover:bg-red-900/50 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isPermissionError ? "권한 재요청" : "다시 시도"}
              </Button>
              {onSwitchToManual && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSwitchToManual}
                  className="text-red-400/70 hover:text-red-300 hover:bg-red-900/30 gap-1.5"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  직접 입력으로 전환
                </Button>
              )}
            </div>
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
            className="gap-2 border-white/30 text-white hover:bg-pn/10 px-8 rounded-xl h-12"
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
