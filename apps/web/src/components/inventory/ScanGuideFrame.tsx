/**
 * §11.374 #scan-guide-frame-unify — 인앱 스캔 가이드 프레임 공통 컴포넌트.
 *
 * 라벨 스캔(LabelScannerModal)과 QR 스캔(QRScanner)이 제각각의 프레임 오버레이를
 *   쓰던 것을 통일한다. accent 코너 4마커가 공통 시각 언어이고, QR 처럼
 *   실시간 디코딩 화면은 showScanLine 으로 스캔 라인을 추가한다.
 *
 * §11.374-vivino — status 로 정합 색 변화(Vivino 식). good=emerald / warn=yellow / idle=blue.
 * - 거래명세서 입고는 native input(capture="environment") 이라 통일 대상 외.
 * - pointer-events-none — 캡처/디코딩 동작 무간섭(오버레이 전용).
 * - canonical truth 무관, 데이터 mutation 0.
 */

interface ScanGuideFrameProps {
  /** QR 등 실시간 디코딩 화면용 스캔 라인 표시(기본 off — 정적 캡처는 프레임만). */
  showScanLine?: boolean;
  /**
   * §11.374-vivino — 정합 상태 색. Vivino 식 "프레임 안에 맞으면 색 변화".
   *   LabelScanner quality.overall 매핑: good→정합(emerald) / warn→주의(yellow) / idle→기본(blue).
   *   미지정 시 idle(기존 blue) — 하위호환.
   */
  status?: "idle" | "good" | "warn";
  /** 바깥 absolute 래퍼에 추가할 클래스(모서리 둥글기/overflow 등). */
  className?: string;
  /** E2E/회귀 hook 보존용 data-testid(예: 라벨의 "camera-guide-frame"). */
  testId?: string;
}

export function ScanGuideFrame({
  showScanLine = false,
  status = "idle",
  className = "",
  testId,
}: ScanGuideFrameProps) {
  // §11.374-vivino — 정합 색(§11.302 신호등). 미지정/idle = 기존 blue-400(하위호환).
  const cornerColor =
    status === "good"
      ? "border-emerald-500"
      : status === "warn"
        ? "border-yellow-500"
        : "border-blue-400";
  const lineColor =
    status === "good"
      ? "bg-emerald-500/80"
      : status === "warn"
        ? "bg-yellow-500/80"
        : "bg-blue-400/80";

  return (
    <div
      data-testid={testId}
      data-scan-status={status}
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
    >
      {/* §11.374b — 고정 w-56 h-56(224px) 은 프리뷰(aspect-[4/3] 등 height<224)보다 커서
          코너 마커가 프리뷰 밖으로 오버플로우(화면 밖). 프리뷰 height 상대(78%) + aspect-square
          로 클램프 → 어떤 프리뷰 비율에서도 항상 안쪽. max-h-56 으로 대형 화면 상한. */}
      <div className="relative h-[78%] aspect-square max-h-56">
        {/* accent 코너 4마커 (공통 시각 언어). §11.374-vivino 정합 시 색 전환. */}
        {(["tl", "tr", "bl", "br"] as const).map((pos) => (
          <div
            key={pos}
            className={`absolute w-7 h-7 border-4 ${cornerColor} transition-colors duration-200
              ${pos === "tl" ? "top-0 left-0 border-r-0 border-b-0 rounded-tl-lg" : ""}
              ${pos === "tr" ? "top-0 right-0 border-l-0 border-b-0 rounded-tr-lg" : ""}
              ${pos === "bl" ? "bottom-0 left-0 border-r-0 border-t-0 rounded-bl-lg" : ""}
              ${pos === "br" ? "bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg" : ""}
            `}
          />
        ))}
        {/* 실시간 디코딩 화면(QR)용 스캔 라인 */}
        {showScanLine && (
          <div
            className={`absolute inset-x-4 top-1/2 h-0.5 ${lineColor} animate-pulse rounded-full transition-colors duration-200`}
          />
        )}
      </div>
    </div>
  );
}
