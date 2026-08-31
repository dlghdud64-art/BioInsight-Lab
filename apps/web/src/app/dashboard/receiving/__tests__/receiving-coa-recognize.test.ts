import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments, violations } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-recognition-upgrade P1 sentinel — COA 인식 → 확인 → 확정 (자동 확정 0).
 *
 * 잠그는 계약:
 *   a) 인식 API = 추출·대조만, canonical 쓰기 0 (draft/item write 금지)
 *   b) inspect PATCH = lotNumber·expiryDate·lotSource·coaOcrJobId additive ·
 *      lotSource=coa_ocr 이면 coaOcrJobId 필수 · restockedAt 409 가드 보존
 *   c) PATCH 는 확정 핸들러에만 — 인식 응답 핸들러에서 저장 0
 *   d) `COA 인식` 배지 = canonical `lotSource === "coa_ocr"` 조건에서만 (UI state truth 금지)
 *   e) 확정 버튼 = evaluateLabelCommitGate(canCommit) 게이트 (호영님 5규칙)
 *   f) 회귀 0 — 모달 inspect payload 는 itemId (구 `id:` 계약 불일치 재발 차단)
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const RECOGNIZE = "src/app/api/receiving-drafts/[id]/coa-recognize/route.ts";
const INSPECT = "src/app/api/receiving-drafts/[id]/inspect/route.ts";
const LIST_ROUTE = "src/app/api/receiving-drafts/route.ts";
const DETAIL_ROUTE = "src/app/api/receiving-drafts/[id]/route.ts";
const LIST = "src/components/receiving/receiving-case-list.tsx";
const MODAL = "src/components/receiving/receiving-batch-modal.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";
const REVIEW = "src/components/ocr/recognized-fields-review.tsx";
const VM = "src/lib/ops-console/receiving-desktop-view-model.ts";

describe("§scan-recognition-upgrade P1 (a) — 인식 API 저장 0", () => {
  it("coa-recognize = runOcrPipeline + 대조만 · draft/item 쓰기 0", () => {
    const src = stripComments(read(RECOGNIZE));
    expect(src).toMatch(/runOcrPipeline\(/);
    expect(src).toMatch(/matchCoaToLines\(/);
    expect(src).toMatch(/coaFieldsFromLabel\(/);
    expect(src).not.toMatch(/receivingDraftItem\.(update|updateMany|create|createMany|delete)/);
    expect(src).not.toMatch(/receivingDraft\.(update|updateMany|delete)/);
    expect(src).not.toMatch(/inventory/i);
  });
});

describe("§scan-recognition-upgrade P1 (b) — inspect PATCH additive 확장", () => {
  it("lotNumber·expiryDate·lotSource·coaOcrJobId — 미전달 시 무접촉(additive)", () => {
    const src = stripComments(read(INSPECT));
    expect(src).toMatch(/input\.lotNumber !== undefined/);
    expect(src).toMatch(/input\.expiryDate !== undefined/);
    expect(src).toMatch(/input\.lotSource !== undefined/);
  });

  it('lotSource="coa_ocr" 이면 coaOcrJobId 필수 (400 · lineage 강제)', () => {
    const src = stripComments(read(INSPECT));
    expect(src).toMatch(
      /lotSource === "coa_ocr"[\s\S]{0,400}?coaOcrJobId[\s\S]{0,400}?status: 400/,
    );
  });

  it("허용 lotSource 값 검증 + restockedAt 409 가드 보존 (회귀 0)", () => {
    const src = read(INSPECT);
    expect(src).toMatch(/"vendor_reply", "coa_ocr", "manual"/);
    expect(src).toMatch(/ALREADY_RESTOCKED/);
    expect(src).toMatch(/status: 409/);
  });
});

describe("§scan-recognition-upgrade P1 (c) — PATCH 는 확정 핸들러에만", () => {
  it("page.tsx 인식 핸들러(recognizeCoa)에 inspect 호출 0", () => {
    const src = stripComments(read(PAGE));
    const recog = src.match(/const recognizeCoa =[\s\S]*?\n  \};/)?.[0];
    expect(recog, "recognizeCoa 핸들러 존재").toBeTruthy();
    expect(recog!).toContain("coa-recognize");
    expect(recog!).not.toContain("/inspect");
    const confirm = src.match(/const confirmCoa =[\s\S]*?\n  \};/)?.[0];
    expect(confirm, "confirmCoa 핸들러 존재").toBeTruthy();
    expect(confirm!).toContain("/inspect");
    expect(confirm!).toContain('lotSource: "coa_ocr"');
  });

  it("배치 모달 인식 핸들러(runCoaRecognition)에 inspect 호출 0 · 확정(confirmCoa)에만", () => {
    const src = stripComments(read(MODAL));
    const recog = src.match(/const runCoaRecognition =[\s\S]*?\n  \}, \[/)?.[0];
    expect(recog, "runCoaRecognition 핸들러 존재").toBeTruthy();
    expect(recog!).toContain("coa-recognize");
    expect(recog!).not.toContain("/inspect");
    const confirm = src.match(/const confirmCoa =[\s\S]*?\n  \}, \[/)?.[0];
    expect(confirm, "confirmCoa 핸들러 존재").toBeTruthy();
    expect(confirm!).toContain("/inspect");
    expect(confirm!).toContain('lotSource: "coa_ocr"');
  });

  it("리뷰 컴포넌트는 표시·확인만 — 자체 fetch 0 (mutation 은 부모 콜백)", () => {
    const src = stripComments(read(REVIEW));
    expect(src).not.toMatch(/csrfFetch|fetch\(/);
  });
});

describe("§scan-recognition-upgrade P1 (d) — 배지 truth = canonical lotSource", () => {
  it("리스트 라인 배지 조건 = lotSource === \"coa_ocr\" 리터럴", () => {
    const src = stripComments(read(LIST));
    expect(src).toMatch(/lotSource === "coa_ocr"[\s\S]{0,400}?COA 인식/);
  });

  it("배치 모달 판정 스텝 배지 조건 = lotSource === \"coa_ocr\" 리터럴", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/lotSource === "coa_ocr"[\s\S]{0,400}?COA 인식/);
  });

  it("lotSource 전파 경로 — 각각 단언 (OR 묶음 금지: 리스트·상세·뷰모델)", () => {
    expect(read(LIST_ROUTE)).toMatch(/lotSource: it\.lotSource/);
    expect(read(DETAIL_ROUTE)).toMatch(/lotSource: it\.lotSource/);
    expect(read(VM)).toMatch(/lotSource: it\.lotSource/);
  });
});

describe("§scan-recognition-upgrade P1 (e) — 확정 게이트 = label-commit-gate", () => {
  // P3 승계(2026-08-31): 게이트 직접 호출 → deriveFieldMarks 단일 소스로 이관.
  //   label-commit-gate 는 recognized-field-marks 내부에서 호출(중복 구현 0) —
  //   그 앵커는 recognized-fields-review.test.ts (1)이 잠근다.
  it("리뷰 컴포넌트 확정 버튼 = 마크 파생 canCommit 게이트", () => {
    const src = stripComments(read(REVIEW));
    expect(src).toMatch(/deriveFieldMarks\(/);
    expect(src).toMatch(/const canConfirm =[^\n]*canCommit/);
    // ①접두사: aria-disabled 가 대신 매칭하지 않게 lookbehind
    expect(src).toMatch(/(?<!aria-)disabled=\{[^}]*canConfirm/);
  });

  it("Lot·유효기간 = 신뢰도 무관 명시 확인 (confirmed 배선 → 파생 입력)", () => {
    const src = stripComments(read(REVIEW));
    expect(src).toMatch(/confirmed: \{ lot: lotChecked, expiry: expiryChecked \}/);
  });
});

describe("§scan-recognition-upgrade P1 (f) — 회귀 0", () => {
  it("모달 inspect payload = itemId (구 id: 계약 불일치 재발 차단)", () => {
    const src = stripComments(read(MODAL));
    expect(src).toMatch(/itemId: cur\.item\.id/);
    expect(src).not.toMatch(/\bid: cur\.item\.id/);
  });

  it("§11.302 — 신규 표면 amber/orange 0 · em dash 구분자 0", () => {
    for (const rel of [REVIEW, RECOGNIZE]) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/amber-\d/);
      expect(src, rel).not.toMatch(/orange-\d/);
      const hits = violations(src);
      expect(hits, `${rel}: ${JSON.stringify(hits)}`).toHaveLength(0);
    }
  });
});
