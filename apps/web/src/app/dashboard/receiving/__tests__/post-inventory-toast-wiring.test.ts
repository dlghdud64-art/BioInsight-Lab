import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/receiving/page.tsx";

/**
 * §action-toast P3 — 입고 반영 토스트 labToast 통일 (원 판본 2026-08 · §receiving-list-redesign 승계)
 *
 * 원 판본은 데스크탑 데모 경로 `postToInventory(item.entityId)` 를 앵커로 잠갔다.
 * §receiving-list-redesign 에서 데스크탑 반영이 canonical /approve(일괄 처리 모달)로
 * 이관되며 그 앵커는 표면 은퇴 — 정책(실 mutation 먼저 → 토스트 · 자체 토스트 금지)은
 * 모바일 잔존 경로 + COA 첨부 경로로 승계해 재앵커한다.
 */
describe("§action-toast P3 승계 — 입고 토스트 labToast 통일", () => {
  it("모바일: 실 mutation(postToInventory) 먼저 → labToast.success (front-only 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/postToInventory\(card\.id\)/);
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    expect(src).toMatch(/labToast\.success\(\s*"재고 반영 완료"/);
    const mutIdx = src.indexOf("postToInventory(card.id)");
    const toastIdx = src.indexOf('"재고 반영 완료"');
    expect(mutIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(mutIdx);
  });

  it("회귀 0 — 구 자체 토스트(setToast state/커스텀 div) 부활 금지", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/setToast/);
    expect(src).not.toMatch(/재고에 반영되었습니다 · /); // 구 문구(자체 토스트) 제거 유지
    expect(src).not.toMatch(/text-emerald-300/); // 구 커스텀 토스트 아이콘 톤
  });
});
