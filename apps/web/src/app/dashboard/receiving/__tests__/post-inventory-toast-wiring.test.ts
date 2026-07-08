import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/receiving/page.tsx";

describe("§action-toast P3 — 입고 재고반영 결과 토스트 labToast 통일", () => {
  it("실 mutation(postToInventory) 성공 후 labToast.success (front-only 아님)", () => {
    const src = read(PAGE);
    // 실 mutation 경로 보존
    expect(src).toMatch(/postToInventory\(item\.entityId\)/);
    // labToast.success 로 통일 + import
    expect(src).toMatch(/import \{ labToast \} from "@\/lib\/toast\/lab-toast"/);
    expect(src).toMatch(/labToast\.success\("재고 반영 완료"/);
    // mutation → toast 순서(front-only 아님: mutation 먼저)
    const mutIdx = src.indexOf("postToInventory(item.entityId)");
    const toastIdx = src.indexOf('labToast.success("재고 반영 완료"');
    expect(mutIdx).toBeGreaterThan(-1);
    expect(toastIdx).toBeGreaterThan(mutIdx);
  });

  it("회귀 0 — 구 자체 토스트(setToast state/useEffect/커스텀 div) 완전 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/setToast/);
    expect(src).not.toMatch(/재고에 반영되었습니다 · /); // 구 문구(자체 토스트) 제거
    expect(src).not.toMatch(/text-emerald-300/); // 구 커스텀 토스트 아이콘 톤
    expect(src).not.toMatch(/useEffect/); // 토스트 전용 effect 제거(다른 effect 없음)
  });
});
