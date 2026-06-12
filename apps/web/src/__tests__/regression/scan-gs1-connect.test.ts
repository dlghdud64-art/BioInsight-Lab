import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §11.382 — GS1 datamatrix connect (라벨 직접등록 추출 dead 봉합).
//   배치: src/__tests__/regression/ (REPO_WEB = 3단계 상승).
//   ⚠️ P1-2(scan-label GS1)·P1-3a(모달 디코드)·P1-4b(#2 신호)는 P3/P4 구현 전 RED(의도).
//      P1-1(머신)·P1-3b(single impl)·P1-4a(fallback 보존)은 GREEN.

const REPO_WEB = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_WEB, rel), "utf8");
}

const MACHINE = "src/lib/ocr/merge-gs1-ocr.ts";
const SCAN_LABEL = "src/app/api/inventory/scan-label/route.ts";
const MODAL = "src/components/inventory/LabelScannerModal.tsx";
const PIPELINE = "src/lib/ocr/run-ocr-pipeline.ts";

describe("§11.382 P1-1 — merge 머신 (P2 GREEN)", () => {
  it("mergeGs1WithOcr + isFieldVerified export", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/export function mergeGs1WithOcr/);
    expect(src).toMatch(/export function isFieldVerified/);
  });

  it("GS1 결정적 우선 — source 'gs1' 태그", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/source:\s*"gs1"/);
    expect(src).toMatch(/conflict/);
  });

  it("verified = gs1 + 불일치 없음 (§11.380 vision-guess 예외)", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/source\s*===\s*"gs1"\s*&&\s*!conflict/);
  });
});

describe("§11.382 P1-2 — scan-label GS1 단계 (P3 RED)", () => {
  it("parseGs1 호출 (서버 single impl 재사용)", () => {
    const src = read(SCAN_LABEL);
    expect(src).toMatch(/parseGs1/);
  });

  it("gs1Raw 입력 수용 (클라 디코드 raw string)", () => {
    const src = read(SCAN_LABEL);
    expect(src).toMatch(/gs1Raw/);
  });

  it("mergeGs1WithOcr 로 source-based 병합", () => {
    const src = read(SCAN_LABEL);
    expect(src).toMatch(/mergeGs1WithOcr/);
  });
});

describe("§11.382 P1-3 — 클라 디코드(P3 RED) + single impl 락(GREEN)", () => {
  it("LabelScannerModal 이 zxing 으로 datamatrix 디코드 (P3 RED)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/@zxing\/browser|BrowserMultiFormatReader|decodeFrom/);
  });

  it("single impl 락 — 클라(모달)는 parseGs1 복제 금지 (서버 전용)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/import.*parseGs1|from\s+["'].*gs1-parser/);
  });
});

describe("§11.382 P1-4 — Gemini fallback 보존(GREEN) + #2 Tier2 신호(P4 RED)", () => {
  it("Gemini fallback 보존 — scan-label runOcrPipeline 잔존 (GS1 대체 아님)", () => {
    const src = read(SCAN_LABEL);
    expect(src).toMatch(/runOcrPipeline/);
  });

  it("#2 Tier2 env 미설정 명시 신호 (silent degradation 제거, P4 RED)", () => {
    const src = read(PIPELINE);
    expect(src).toMatch(/tier2Configured|tier2Skipped|TIER2_UNCONFIGURED|tier2Degraded|fallbackReason/);
  });
});

describe("§11.382 P1-5 — P4 verified gate 연결 + #2 신호", () => {
  it("모달 verified gate 가 isFieldVerified 연결(false 하드코딩 제거)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/verified:\s*\{\s*lot:\s*lotVerified/);
    expect(src).not.toMatch(/verified:\s*\{\s*lot:\s*false,\s*expiry:\s*false\s*\}/);
  });
  it("#2 Tier2 env 미설정 명시 사유(tier2_unconfigured)", () => {
    const src = read(PIPELINE);
    expect(src).toMatch(/tier2_unconfigured/);
  });
});
