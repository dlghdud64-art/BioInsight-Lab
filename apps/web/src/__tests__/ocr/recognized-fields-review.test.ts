import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments, violations } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-recognition-upgrade P3 sentinel — 필드별 신뢰도 확인 화면 공통화.
 *
 * 잠그는 계약:
 *   1) 마크 파생 = deriveFieldMarks(내부에서 label-commit-gate 호출 — 중복 구현 0)
 *   2) 색: 확신 = blue(bg-blue-50 text-blue-700) · 불확실 = yellow + "확인 필요" · amber 0
 *   3) 원본 병기: bbox 있으면 하이라이트 오버레이 · **bbox == null 이면 원본 전체**
 *      (하이라이트 지어내기 0 — Gemini 는 bbox 를 안 준다)
 *   4) 자동 확정 0 — 마운트 effect 에서 onConfirm 호출 금지 · 확정 버튼 = canCommit 게이트
 *   5) 3 surface: 배치 모달 COA 스텝(RecognizedFieldsReview) · 리스트 드롭존 ·
 *      SmartReceivingScannerModal(단품 Lot·유효기한 + 다품목 수량 셀 = RecognizedFieldInput).
 *      LabelScannerModal 은 P3 제외(무접촉) — 291·290-p4b 앵커 보존.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const REVIEW = "src/components/ocr/recognized-fields-review.tsx";
const MARKS = "src/lib/ocr/recognized-field-marks.ts";
const SMART = "src/components/inventory/SmartReceivingScannerModal.tsx";
const BATCH = "src/components/receiving/receiving-batch-modal.tsx";
const CASELIST = "src/components/receiving/receiving-case-list.tsx";
const LABEL = "src/components/inventory/LabelScannerModal.tsx";

describe("§scan-recognition-upgrade P3 (1) — 마크 파생 단일 소스", () => {
  it("리뷰 컴포넌트는 deriveFieldMarks 를 쓴다 (게이트 직접 재구현 0)", () => {
    const src = stripComments(read(REVIEW));
    expect(src).toMatch(/deriveFieldMarks\(/);
  });

  it("deriveFieldMarks 는 evaluateLabelCommitGate 내부 호출 (Lot·유효기간 규칙 무접촉)", () => {
    const src = stripComments(read(MARKS));
    expect(src).toMatch(/evaluateLabelCommitGate\(\{/);
    expect(src).not.toMatch(/lot-unconfirmed/); // 규칙 재구현 금지 — blocker 는 gate 산출 승계
  });
});

describe("§scan-recognition-upgrade P3 (2) — 색·타이포", () => {
  it("확신 = blue · 불확실 = yellow + 확인 필요 · amber/orange 0 · em dash 0", () => {
    const src = read(REVIEW);
    expect(src).toMatch(/bg-blue-50[^"]*text-blue-700|text-blue-700[^"]*bg-blue-50/);
    expect(src).toMatch(/bg-yellow-50[^"]*text-yellow-700|yellow-50\/40/);
    expect(src).toMatch(/확인 필요/);
    expect(src).not.toMatch(/amber-\d/);
    expect(src).not.toMatch(/orange-\d/);
    const hits = violations(src);
    expect(hits, JSON.stringify(hits)).toHaveLength(0);
  });
});

describe("§scan-recognition-upgrade P3 (3) — 원본 병기 (하이라이트 지어내기 0)", () => {
  it("bbox == null 분기 = 원본 전체 · bbox 있으면 하이라이트 오버레이", () => {
    const src = stripComments(read(REVIEW));
    expect(src).toMatch(/bbox == null/);
    expect(src).toMatch(/data-surface="recognized-source-full"/);
    expect(src).toMatch(/data-surface="recognized-source-highlight"/);
  });
});

describe("§scan-recognition-upgrade P3 (4) — 자동 확정 0", () => {
  it("마운트 effect 에서 onConfirm 호출 0 · 확정 버튼 = canCommit 게이트", () => {
    const src = stripComments(read(REVIEW));
    expect(src).not.toMatch(/useEffect\([\s\S]{0,600}?onConfirm/);
    expect(src).toMatch(/const canConfirm =[^\n]*canCommit/);
    expect(src).toMatch(/(?<!aria-)disabled=\{[^}]*canConfirm/);
  });
});

describe("§scan-recognition-upgrade P3 (5) — 3 surface 교체 · LabelScanner 무접촉", () => {
  it("배치 모달 COA 스텝 + 리스트 드롭존 = RecognizedFieldsReview", () => {
    expect(stripComments(read(BATCH))).toMatch(/<RecognizedFieldsReview/);
    expect(stripComments(read(CASELIST))).toMatch(/<RecognizedFieldsReview/);
  });

  it("SmartReceiving — 단품 Lot·유효기한 + 다품목 수량 셀 = RecognizedFieldInput", () => {
    const src = stripComments(read(SMART));
    expect(src).toMatch(/from "@\/components\/ocr\/recognized-fields-review"/);
    const uses = src.match(/<RecognizedFieldInput/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
    // 기존 계약 보존 — id·마크 리터럴은 표면에 남는다(291/309d/exp-qc 앵커 무접촉 원칙과 동형)
    expect(src).toMatch(/id="srm-lotNumber"/);
    expect(src).toMatch(/id="srm-expirationDate"/);
  });

  it("LabelScannerModal 무접촉 — recognized-fields-review import 0 (291·290-p4b 보존)", () => {
    const src = stripComments(read(LABEL));
    expect(src).not.toMatch(/recognized-fields-review/);
    expect(src).toMatch(/function ConfidenceBadge\(/); // 290-p4b 앵커 실측 동행
  });
});
