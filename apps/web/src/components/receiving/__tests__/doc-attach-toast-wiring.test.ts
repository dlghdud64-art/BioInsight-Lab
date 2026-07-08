import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MODAL = "src/components/receiving/receiving-doc-attach-modal.tsx";

describe("§action-toast P3 — 입고 문서첨부 필수세트 완료 토스트(완료 시 1회)", () => {
  it("실 첨부(onAttach=store.attachReceivingDocument) 후 labToast.success — front-only 아님", () => {
    const src = read(MODAL);
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    // handleAttach 래퍼가 실 mutation(onAttach) 먼저 호출
    expect(src).toMatch(/const handleAttach = \(lineId: string, docType: DocType, lotId\?: string\) =>/);
    const attachIdx = src.indexOf("onAttach(lineId, docType, lotId)");
    const toastIdx = src.indexOf("labToast.success(");
    expect(attachIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(attachIdx); // mutation 먼저 → 성공 후 토스트
  });

  it("완료 판정 = 이번 첨부가 마지막 미첨부(remaining===1) → 필수세트 완료 1회", () => {
    const src = read(MODAL);
    expect(src).toMatch(/if \(remaining === 1\)/);
    expect(src).toMatch(/필수 문서\(CoA·MSDS\)가 모두 첨부되었습니다/);
  });

  it("회귀 0 — 개별 첨부 버튼이 handleAttach 경유(직접 onAttach 호출 잔존 금지)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onClick=\{\(\) => handleAttach\(line\.id, type\)\}/);
    // onClick 에서 onAttach 직접 호출 잔존 금지(반드시 래퍼 경유)
    expect(src).not.toMatch(/onClick=\{\(\) => onAttach\(/);
  });
});
