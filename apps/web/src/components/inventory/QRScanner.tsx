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

type ScannerState = "idle" | "requesting" | "scanning" | "paused" | "error";

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
 * QRScanner — html5-qrcode 기반 카메라 QR 스캐너 컴포넌트
 *
 * - 모바일: 후면 카메라(environment exact) 우선 → soft fallback
 * - 카메라 권한 거부 시 "권한 재요청" / "직접 입력으로 전환" 버튼
 * - 언마운트 시 스트림 트랙 강제 정리 → Black Screen 방지
 * - 마운트마다 고유 ID 사용 → 재오픈 시 DOM 충돌 방지
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
  const scannerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  // §11.373 — start in-flight 직렬화. stop↔start race(이전 트랙 미정리 상태에서
  //   새 start)로 인한 device 점유 충돌 → 검은화면을 막기 위해 진행 중 중복 start 차단.
  const startingRef = useRef(false);

  // 마운트마다 고유 ID 생성 → 재오픈 시 이전 DOM 잔여물과 충돌 방지
  const scannerIdRef = useRef(
    `bio-qr-scanner-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 외부 paused prop 변화 처리
  useEffect(() => {
    if (paused && state === "scanning") {
      pauseScanner();
    } else if (!paused && state === "paused") {
      resumeScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  /**
   * html5-qrcode가 내부적으로 트랙 정리를 완료하지 못한 경우를 대비한
   * 강제 비디오 스트림 트랙 종료 → 카메라 LED 소등 및 다음 오픈 시 Black Screen 방지
   */
  const stopVideoTracks = useCallback((elementId: string) => {
    try {
      const container = document.getElementById(elementId);
      const videoEl = container?.querySelector("video");
      if (videoEl?.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoEl.srcObject = null;
      }
    } catch {
      // ignore — 이미 정리된 경우
    }
  }, []);

  const stopScanner = useCallback(async () => {
    const id = scannerIdRef.current;
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
    // html5-qrcode 내부 정리가 불완전할 경우 트랙 강제 종료
    stopVideoTracks(id);
  }, [stopVideoTracks]);

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

  /**
   * §11.373 — start resolve 후 실제 video 프레임이 잡혔는지 확인.
   * device 점유 충돌 시 html5-qrcode start 는 resolve 하나 video 가 검은(videoWidth 0).
   * 짧게 polling 해 활성(videoWidth>0 + readyState≥2)을 확인, 미충족이면 false.
   */
  const verifyVideoActive = useCallback(async (elementId: string): Promise<boolean> => {
    const deadline = Date.now() + 1200;
    while (Date.now() < deadline) {
      if (!mountedRef.current) return false;
      const videoEl = document.getElementById(elementId)?.querySelector("video");
      if (videoEl && videoEl.videoWidth > 0 && videoEl.readyState >= 2) {
        // §11.373b — videoWidth 는 stream intrinsic 해상도라 "보이는지"를 보장 못 한다
        //   (0높이/숨김 video 도 videoWidth>0 통과 → 검은화면 위장). 실제 렌더 박스
        //   (getBoundingClientRect)까지 확인해 화면에 안 잡히는 검정을 정직하게 가른다.
        const rect = videoEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return true;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    return false;
  }, []);

  const startScanner = useCallback(async () => {
    // §11.373 — in-flight 직렬화: 진행 중이면 중복 start 차단(연타·재오픈 중첩 → race).
    if (startingRef.current) return;
    startingRef.current = true;
    setErrorMsg(null);
    setIsPermissionError(false);
    setState("requesting");

    const id = scannerIdRef.current;

    try {
      // 동적 import — SSR 안전
      const { Html5Qrcode } = await import("html5-qrcode");

      // 이전 인스턴스 완전 정리
      await stopScanner();
      // §11.373 — stop 후 yield: html5-qrcode 내부 track 정리가 stop() resolve 이후에도
      //   미완일 수 있어, 새 start 전 microtask 틈을 줘 device 점유 충돌을 완화한다.
      await new Promise((r) => setTimeout(r, 0));
      if (!mountedRef.current) return;

      // DOM 잔여 요소(video, canvas 등) 강제 클리어 → Black Screen 방지
      const container = document.getElementById(id);
      if (container) container.innerHTML = "";

      const html5QrCode = new Html5Qrcode(id);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      };

      const successCb = (decodedText: string) => {
        if (mountedRef.current) onScanSuccess(decodedText);
      };
      const qrNotFoundCb = () => { /* QR 미감지, silent */ };

      try {
        // 1차: 후면 카메라 exact 지정 (iOS Safari / Android Chrome 권장)
        await html5QrCode.start(
          { facingMode: { exact: "environment" } },
          config,
          successCb,
          qrNotFoundCb,
        );
      } catch {
        // 2차 fallback: exact 없이 environment (구형 기기 / 브라우저 호환)
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          successCb,
          qrNotFoundCb,
        );
      }

      if (!mountedRef.current) return;

      // §11.373d — html5-qrcode ESM 빌드(우리가 import)는 내부 <video> 에 autoplay 를 설정하지
      //   않는다(muted/playsInline 만, style.width 만 px·height 미설정). iOS Safari 는 autoplay
      //   없으면 첫 프레임을 안 그려 검은화면 → verifyVideoActive false → 에러카드. start 후 DOM
      //   video 에 autoplay/playsinline 속성 강제 주입 + play() 재호출(§11.373c LabelScanner 동일 근본).
      const injectedVideo = document.getElementById(id)?.querySelector("video");
      if (injectedVideo) {
        injectedVideo.setAttribute("autoplay", "true");
        injectedVideo.setAttribute("playsinline", "true");
        injectedVideo.muted = true;
        await injectedVideo.play().catch(() => {});
      }

      // §11.373 — 검은화면 위장 제거(H3): start 가 resolve 해도 실제 video 프레임이
      //   안 잡히면(device 충돌) videoWidth 0. scanning 으로 위장하지 않고 에러 처리.
      const active = await verifyVideoActive(id);
      if (!active) {
        if (!mountedRef.current) return;
        const blackMsg = "카메라 화면을 표시할 수 없습니다. 다시 시도하세요.";
        setErrorMsg(blackMsg);
        setState("error");
        onScanError?.(blackMsg);
        await stopScanner();
        return;
      }

      setState("scanning");
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error("QR Scanner error:", err);

      let msg = "카메라를 시작할 수 없습니다.";
      let isPermErr = false;

      if (
        err?.name === "NotAllowedError" ||
        err?.message?.includes("Permission") ||
        err?.message?.includes("permission")
      ) {
        msg =
          "카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해 주세요.";
        isPermErr = true;
      } else if (err?.name === "NotFoundError") {
        msg = "카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인하세요.";
      } else if (err?.name === "NotReadableError") {
        msg =
          "카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료한 후 다시 시도하세요.";
      }

      setErrorMsg(msg);
      setIsPermissionError(isPermErr);
      setState("error");
      onScanError?.(msg);
      await stopScanner();
    } finally {
      // §11.373 — in-flight 가드 해제(성공/실패/위장 모든 경로).
      startingRef.current = false;
    }
  }, [onScanSuccess, onScanError, stopScanner, verifyVideoActive]);

  const handleReset = useCallback(async () => {
    await stopScanner();
    setState("idle");
    setErrorMsg(null);
    setIsPermissionError(false);
  }, [stopScanner]);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* 뷰파인더 영역 */}
      <div className="relative w-full max-w-sm">
        {/* html5-qrcode 마운트 포인트 — 마운트마다 고유 ID
            §11.373b — html5-qrcode 가 <video> 에 박는 inline px 크기가 aspect-square 컨테이너와
            충돌해 표시 0/오버플로우(검은화면) → 자식 video 를 컨테이너에 강제로 채운다. */}
        <div
          id={scannerIdRef.current}
          className={`w-full rounded-2xl overflow-hidden bg-black aspect-square [&_video]:!w-full [&_video]:!h-full [&_video]:!max-w-none [&_video]:!object-cover ${
            state === "scanning" || state === "paused" ? "block" : "hidden"
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
              {/* 권한 재요청 또는 다시 시도 */}
              <Button
                size="sm"
                variant="outline"
                onClick={startScanner}
                className="border-red-700 text-red-300 hover:bg-red-900/50 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isPermissionError ? "권한 재요청" : "다시 시도"}
              </Button>
              {/* 직접 입력 전환 (onSwitchToManual 제공 시에만 표시) */}
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
