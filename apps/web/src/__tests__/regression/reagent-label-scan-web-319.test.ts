/**
 * §11.319 Phase 3 (RED) — 웹 LabelScannerModal 라이브 프레임 + 가이드 + 휴리스틱 게이트
 *
 * A안 (호영님 2026-05-29):
 *   - 카메라 / 파일 업로드 모드 토글 (default 카메라). 파일 업로드 경로 보존.
 *   - capture-quality(흐림/조명) 게이트: good=자동+수동+OCR / warn=수동+OCR(경고) /
 *     poor=차단+OCR 미호출, "그래도 시도" 우회 링크.
 *   - 자동 캡처 토글 default 수동(off). 인라인 힌트.
 *   - 503-정직 보정 저장 / 기존 파일피커·드래그드롭·텍스트 입력 회귀 0.
 *
 * web vitest sentinel(readFileSync+regex). 구현 전이므로 RED.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const MODAL = "src/components/inventory/LabelScannerModal.tsx";

describe("§11.319 Phase 3 — capture-quality 연동", () => {
  it("assessFrameQuality + mapOcrConfidence import", () => {
    const src = read(MODAL);
    expect(src).toMatch(/from ["']@\/lib\/ocr\/capture-quality["']/);
    expect(src).toMatch(/assessFrameQuality/);
    expect(src).toMatch(/mapOcrConfidence/);
  });
});

describe("§11.319 Phase 3 — 라이브 카메라 + 가이드 프레임", () => {
  it("getUserMedia 라이브 스트림 사용", () => {
    const src = read(MODAL);
    expect(src).toMatch(/getUserMedia/);
    expect(src).toMatch(/facingMode/);
  });

  it("video + canvas 프레임 캡처 ref", () => {
    const src = read(MODAL);
    expect(src).toMatch(/videoRef/);
    expect(src).toMatch(/canvasRef|getImageData/);
  });

  it("스트림 정리(cleanup) — getTracks stop", () => {
    const src = read(MODAL);
    expect(src).toMatch(/getTracks\(\)/);
    expect(src).toMatch(/\.stop\(\)/);
  });

  it("가이드 프레임 오버레이", () => {
    const src = read(MODAL);
    expect(src).toMatch(/가이드|guide-frame|guideFrame/);
  });
});

describe("§11.319 Phase 3 — 모드 토글 + 자동 캡처", () => {
  it("카메라 / 파일 업로드 모드 토글", () => {
    const src = read(MODAL);
    expect(src).toMatch(/uploadMode|captureMode/);
    expect(src).toMatch(/카메라/);
    expect(src).toMatch(/파일 업로드/);
  });

  it("자동 캡처 토글 default 수동(off)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/자동 캡처/);
    // default off — useState(false) 패턴
    expect(src).toMatch(/autoCapture/);
    expect(src).toMatch(/useState(<[^>]*>)?\(false\)/);
  });
});

describe("§11.319 Phase 3 — 휴리스틱 게이트", () => {
  it("poor 시 OCR 미호출 + 그래도 시도 우회", () => {
    const src = read(MODAL);
    expect(src).toMatch(/그래도 시도/);
    expect(src).toMatch(/poor/);
  });

  it("verdict/품질 안내 노출(흐림/조명 reasons)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/overall|verdict|captureConfidence/);
    expect(src).toMatch(/흐림|조명|재촬영/);
  });
});

describe("§11.319 Phase 3 — 회귀 0 (기존 경로 보존)", () => {
  it("파일 업로드(capture 파일피커) + 드래그드롭 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/capture="environment"/);
    expect(src).toMatch(/handleDrop/);
    expect(src).toMatch(/handleFileChange/);
  });

  it("텍스트 직접 입력 경로 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/submitManualText/);
    expect(src).toMatch(/manualMode/);
  });

  it("503-정직 보정 저장 / 재처리 + provider badge 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/ocr-correct-button|보정 저장/);
    expect(src).toMatch(/ocr-retry-button|재처리/);
    expect(src).toMatch(/ProviderBadge/);
    expect(src).toMatch(/ConfidenceBadge/);
  });

  it("scan-label API + 편집 폼 + 입고 prefill 콜백 보존", () => {
    const src = read(MODAL);
    expect(src).toMatch(/\/api\/inventory\/scan-label/);
    expect(src).toMatch(/onDirectReceive|onScanComplete/);
    expect(src).toMatch(/SmartReceiveFormData/);
  });
});
