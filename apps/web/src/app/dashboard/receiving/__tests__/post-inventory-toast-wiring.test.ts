import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

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
describe("§action-toast P3 승계 · 입고 토스트 labToast 통일", () => {
  // §receiving-mobile-canonical (2026-09-22 · 호영님 판정) 승계 — 모바일 잔존 데모 경로가 사라졌다.
  //   정책은 그대로다: **저장이 먼저, 토스트는 그 결과로만.** 앵커를 살아 있는 실 API 경로(COA 첨부)로 옮긴다.
  //   반영 성공 토스트는 이제 일괄 처리 모달(/approve)이 낸다 — 이 화면에는 반영 토스트가 없다.
  it("실 API 응답 확인 뒤에만 성공 토스트 (front-only 아님)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    // COA 첨부: csrfFetch → !res.ok 면 error 토스트 → 성공 토스트는 그 뒤
    const postIdx = src.indexOf("await csrfFetch(`/api/receiving/documents/${row.orderId}`");
    const failIdx = src.indexOf('labToast.error("문서 첨부 실패"');
    const okIdx = src.indexOf('labToast.success("COA 첨부 완료"');
    expect(postIdx).toBeGreaterThan(-1);
    expect(failIdx).toBeGreaterThan(postIdx);
    expect(okIdx).toBeGreaterThan(failIdx);
    // 저장 없이 성공을 말하던 데모 경로 0
    expect(stripComments(src)).not.toMatch(/postToInventory/);
    expect(src).not.toMatch(/labToast\.success\(\s*"재고 반영 완료"/);
  });

  it("회귀 0 · 구 자체 토스트(setToast state/커스텀 div) 부활 금지", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/setToast/);
    expect(src).not.toMatch(/재고에 반영되었습니다 · /); // 구 문구(자체 토스트) 제거 유지
    expect(src).not.toMatch(/text-emerald-300/); // 구 커스텀 토스트 아이콘 톤
  });
});
