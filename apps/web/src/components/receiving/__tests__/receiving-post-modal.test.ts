import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MODAL = "src/components/receiving/receiving-post-modal.tsx";
const PAGE = "src/app/dashboard/receiving/page.tsx";

describe("§11.334 P4 — 재고 반영 same-canvas 모달", () => {
  it("확인/취소 실 핸들러 + Esc 닫기 (no-op 0)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/onClick=\{\(\) => onConfirm\(item\)\}/);
    expect(src).toMatch(/onClick=\{onClose\}/);
    expect(src).toMatch(/e\.key === "Escape"/);
  });

  it("저장 위치 select 미노출 (approve 미지원 → dead field 방지)", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/<select/);
  });

  it("무효 Tailwind 스케일 없음", () => {
    const src = read(MODAL);
    expect(src).not.toMatch(/h-4\.5|w-4\.5/);
  });
});

describe("§11.334 P4 — page 재고반영 배선(실 mutation)", () => {
  it("post 액션만 모달 승격, coa/inspect 는 상세 라우트", () => {
    const src = read(PAGE);
    expect(src).toMatch(/if \(action === "post"\)/);
    expect(src).toMatch(/setPostModalItem\(item\)/);
  });

  it("확정 = store.postToInventory(rb.id) 실 mutation (front-only 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/unifiedInboxItems, postToInventory/);
    expect(src).toMatch(/postToInventory\(item\.entityId\)/);
  });

  it("성공 후 토스트 + 모달 닫기", () => {
    const src = read(PAGE);
    expect(src).toMatch(/재고에 반영되었습니다/);
    expect(src).toMatch(/setPostModalItem\(null\)/);
  });
});
