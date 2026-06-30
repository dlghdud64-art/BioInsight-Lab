/**
 * §scan-mobile-align-merge (호영님 2026-06-30) — 모바일 스캔 정합 글로우(A) + 다장 캡처 병합(B).
 *
 * A: label-capture 가이드프레임에 비차단 Vivino 글로우(translucent emerald) — lockState 바인딩.
 *    웹 픽셀정합 이식 아님(모바일 getImageData 부재). 기존 라이브 lock 신호 재사용. §11.375 보존.
 * B: mergeLabelForm(fill-empty) — 빈 필드만 채움, 채워진/dirty 값 보존, catalogNo 누적 보완.
 *    "다른 각도 재촬영(누적)" 경로. §11.340 source 배지 보존. canonical 무접촉(draft 병합).
 *
 * 패턴: label-lock-380 동일 — 순수 util 실 import + scan.tsx 소스 regex sentinel.
 *   RN/VisionCamera 런타임 무의존(실기기 없이 vitest 검증).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// B 핵심 util — Phase 2 에서 생성. 현재 미존재 → import 실패(RED).
import {
  mergeLabelForm,
  type LabelForm,
} from "../../../../mobile/lib/inventory/merge-label-form";

const SRC = resolve(__dirname, "../.."); // apps/web/src
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");
const scanSrc = () => read("../../mobile/app/scan.tsx");

function form(p: Partial<LabelForm> = {}): LabelForm {
  return {
    productName: "",
    catalogNumber: "",
    lotNumber: "",
    expirationDate: "",
    packSize: "",
    packUnit: "",
    receivedQuantity: "1",
    receivedUnit: "통",
    brand: "",
    casNumber: "",
    ...p,
  };
}

/* ───────── B: mergeLabelForm 단위 (fill-empty) ───────── */

describe("§scan-mobile-align-merge — mergeLabelForm(fill-empty)", () => {
  it("빈 catalogNo 를 새 스캔이 채움(곡면 병 누적 보완)", () => {
    const prev = form({ productName: "BCP", brand: "Sigma", catalogNumber: "" });
    const incoming = form({ productName: "BCP", brand: "Sigma", catalogNumber: "B9673" });
    const r = mergeLabelForm(prev, incoming);
    expect(r.catalogNumber).toBe("B9673");
    expect(r.productName).toBe("BCP");
  });

  it("이미 채워진 값(이전 스캔/사용자 수정)은 보존 — 새 값으로 안 덮음", () => {
    const prev = form({ productName: "사용자수정명", catalogNumber: "KEEP-1" });
    const incoming = form({ productName: "OCR명", catalogNumber: "OTHER-2", lotNumber: "L9" });
    const r = mergeLabelForm(prev, incoming);
    expect(r.productName).toBe("사용자수정명"); // 보존
    expect(r.catalogNumber).toBe("KEEP-1"); // 보존
    expect(r.lotNumber).toBe("L9"); // 빈칸만 채움
  });

  it("공백 trim 후 빈칸 취급 — 새 값으로 채움", () => {
    const prev = form({ lotNumber: "   " });
    const incoming = form({ lotNumber: "LOT-7" });
    const r = mergeLabelForm(prev, incoming);
    expect(r.lotNumber).toBe("LOT-7");
  });

  it("received*(기본 1/통)는 비어있지 않아 항상 보존(사용자 입력 보호)", () => {
    const prev = form({ receivedQuantity: "5", receivedUnit: "박스" });
    const incoming = form({ receivedQuantity: "1", receivedUnit: "통", lotNumber: "L1" });
    const r = mergeLabelForm(prev, incoming);
    expect(r.receivedQuantity).toBe("5");
    expect(r.receivedUnit).toBe("박스");
    expect(r.lotNumber).toBe("L1");
  });

  it("incoming 모두 빈칸이면 prev 무변경", () => {
    const prev = form({ productName: "Tris", catalogNumber: "T1503" });
    const r = mergeLabelForm(prev, form());
    expect(r.productName).toBe("Tris");
    expect(r.catalogNumber).toBe("T1503");
  });

  it("순수 함수 — prev 원본 불변(mutation 0)", () => {
    const prev = form({ catalogNumber: "" });
    const incoming = form({ catalogNumber: "X" });
    mergeLabelForm(prev, incoming);
    expect(prev.catalogNumber).toBe(""); // 원본 보존
  });
});

/* ───────── A: 정합 글로우 sentinel (scan.tsx) ───────── */

describe("§scan-mobile-align-merge — A 정합 글로우 wiring", () => {
  it("§scan-mobile-align-glow 마커 + lockState 바인딩 글로우 존재", () => {
    const src = scanSrc();
    expect(src).toMatch(/§scan-mobile-align-glow/);
    // translucent emerald 채움(웹 bg-emerald-400/10 대응)
    expect(src).toMatch(/bg-emerald-\d+\/(10|20|30)/);
  });

  it("글로우는 비차단(pointerEvents none) — 촬영/버튼 무간섭", () => {
    const src = scanSrc();
    const glow = src.slice(src.indexOf("§scan-mobile-align-glow"));
    expect(glow).toMatch(/pointerEvents=["']none["']|pointer-events-none/);
  });

  it("글로우는 isLocked 에 바인딩(라이브 lock 신호) — verdict/촬영 게이팅 아님", () => {
    const src = scanSrc();
    const glow = src.slice(
      src.indexOf("§scan-mobile-align-glow"),
      src.indexOf("§scan-mobile-align-glow") + 600,
    );
    expect(glow).toMatch(/isLocked/);
  });
});

/* ───────── B: 누적 재촬영 wiring sentinel (scan.tsx) ───────── */

describe("§scan-mobile-align-merge — B 누적 재촬영 wiring", () => {
  it("§scan-mobile-multi-merge 마커 + mergeLabelForm 사용", () => {
    const src = scanSrc();
    expect(src).toMatch(/§scan-mobile-multi-merge/);
    expect(src).toMatch(/mergeLabelForm/);
  });

  it('"다른 각도 재촬영"(누적) CTA 존재', () => {
    expect(scanSrc()).toMatch(/다른 각도 재촬영/);
  });

  it("handleCaptureLabel 가 merge 분기 인자 보유(누적 vs 단일)", () => {
    const src = scanSrc();
    // 정의: (merge = false) 파라미터 / 호출: accumulate 플래그 전달
    expect(src).toMatch(/handleCaptureLabel\s*=\s*useCallback\(async\s*\(\s*merge/);
    expect(src).toMatch(/handleCaptureLabel\(accumulate\)/);
  });
});

/* ───────── 회귀 0 (기존 보존 강제) ───────── */

describe("§scan-mobile-align-merge — 회귀 0", () => {
  it('기존 "재촬영"(전체 초기화) 경로 잔존(resetToScan)', () => {
    const src = scanSrc();
    expect(src).toMatch(/재촬영/);
    expect(src).toMatch(/resetToScan/);
  });

  it("§11.340 source flag setter 보존(라벨스캔 vs 수기 배지)", () => {
    const src = scanSrc();
    expect(src).toMatch(/setLotScanFilled/);
    expect(src).toMatch(/setExpiryScanFilled/);
  });

  it("§11.375 경계 보존 — lock=신호, 진위 아님(verdict 후단 게이트 무변경)", () => {
    const src = scanSrc();
    expect(src).toMatch(/evaluateLabelCommitGate/); // OCR 후단 commit 게이트 유지
    expect(src).toMatch(/진위 아님|진위 판정 아님|신호 전용/); // §11.375 주석 보존
  });

  it("lockState 라이브 신호 자체 보존(§11.380)", () => {
    const src = scanSrc();
    expect(src).toMatch(/lockState/);
    expect(src).toMatch(/stepLock/);
  });
});
