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

// §receiving-list-redesign(2026-08-30) supersede — 데스크탑 반영이 데모 postToInventory 에서
//   canonical 일괄 처리 모달(POST /api/receiving-drafts/[id]/approve · 서버 이중 반영 가드)로
//   이관되며 구 page 배선 앵커(setPostModalItem · postToInventory(item.entityId)) 은퇴.
//   원 의도(front-only 반영 금지·실 mutation 우선)는
//   src/app/dashboard/receiving/__tests__/receiving-list-redesign.test.ts +
//   post-inventory-toast-wiring.test.ts(모바일 승계 앵커)가 재앵커한다.
describe("§11.334 P4 승계 — 데모 반영 모달 page 배선 금지(§receiving-list-redesign)", () => {
  it("page 에 데모 반영 모달·데모 데스크탑 반영 경로 재배선 0", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/setPostModalItem/);
    expect(src).not.toMatch(/postToInventory\(item\./);
  });
});
