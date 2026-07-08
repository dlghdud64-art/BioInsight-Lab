import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §receiving-doc-attach-v2 (호영님 2026-07-08) — 문서 확보 모달 v2 폼팩터
 *   (입고 목록 웹 리디자인 v2.html §mDoc). PLAN_receiving-list-v2 Phase 1.
 *
 * 바텀 Sheet → same-canvas 센터 Dialog. 통합 업로드/문서별 첨부 탭 + 드롭존(정직-disabled).
 * ⚠ per-lot(CoA·MSDS) GMP 모델·실 attach wiring·완료 토스트 전부 보존(회귀 0).
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const MODAL = "src/components/receiving/receiving-doc-attach-modal.tsx";

describe("§receiving-doc-attach-v2 — 센터 Dialog 폼팩터", () => {
  it("바텀 Sheet 제거 → same-canvas 센터 Dialog(role=dialog, aria-modal)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/from "@\/components\/ui\/sheet"/);
    expect(src).toMatch(/role="dialog"/);
    expect(src).toMatch(/aria-modal="true"/);
    expect(src).toMatch(/items-center justify-center/); // 센터 정렬
  });

  it("통합 업로드 / 문서별 첨부 탭 — 기본 탭 = 문서별 첨부(no-op default 회피)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/통합 업로드/);
    expect(src).toMatch(/문서별 첨부/);
    expect(src).toMatch(/useState<DocTab>\("byDoc"\)/);
  });

  it("통합 업로드 드롭존 = 정직-disabled(실 업로드 미주장)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/파일 업로드는 입고 DB 연동 후 제공됩니다/);
    expect(src).toMatch(/border-dashed/);
  });

  it("반영 차단 callout(§11.302 muted amber)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/재고 반영 차단/);
    expect(src).toMatch(/bg-\[#fdf3ec\] text-\[#b45821\]/);
  });
});

describe("§receiving-doc-attach-v2 — 회귀 0(GMP per-lot · 실 wiring 보존)", () => {
  it("per-line/per-lot 문서 모델 보존(성적서 CoA·MSDS·lotRecords)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/성적서 \(CoA\)/);
    expect(src).toMatch(/MSDS/);
    expect(src).toMatch(/line\.lotRecords/);
    expect(src).toMatch(/lot\.coaAttached/);
    expect(src).toMatch(/lot\.msdsAttached/);
  });

  it("실 첨부 wiring 보존 — handleAttach → onAttach, 완료 시 labToast 1회", () => {
    const src = read(MODAL);
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    expect(src).toMatch(/const handleAttach = \(lineId: string, docType: DocType, lotId\?: string\) =>/);
    const attachIdx = src.indexOf("onAttach(lineId, docType, lotId)");
    const toastIdx = src.indexOf("labToast.success(");
    expect(attachIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(attachIdx); // mutation 먼저 → 성공 후 토스트
    expect(src).toMatch(/if \(remaining === 1\)/);
    expect(src).toMatch(/onClick=\{\(\) => handleAttach\(line\.id, type\)\}/);
    expect(src).not.toMatch(/onClick=\{\(\) => onAttach\(/); // 직접 onAttach onClick 금지
  });
});
