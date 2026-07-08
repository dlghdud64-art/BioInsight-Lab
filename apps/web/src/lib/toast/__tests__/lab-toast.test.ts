import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const USE_TOAST = "src/hooks/use-toast.ts";
const TOAST = "src/components/ui/toast.tsx";
const TOASTER = "src/components/ui/toaster.tsx";
const LAB = "src/lib/toast/lab-toast.tsx";

describe("§action-toast — shadcn 확장(A안)", () => {
  it("동시 3개 (TOAST_LIMIT)", () => {
    expect(read(USE_TOAST)).toMatch(/const TOAST_LIMIT = 3/);
  });
  it("progress 필드 (진행 바)", () => {
    expect(read(USE_TOAST)).toMatch(/progress\?: number/);
  });
  it("variant 5종(흰 배경, 아이콘색 구분) — 기존 default/destructive 보존", () => {
    const src = read(TOAST);
    for (const v of ["success:", "warning:", "error:", "info:", "undo:"]) expect(src).toContain(v);
    expect(src).toContain('default: "border bg-background text-foreground"');
    expect(src).toMatch(/destructive:/);
  });
});

describe("§action-toast — Toaster 렌더(아이콘·progress·닫기 규칙)", () => {
  it("variant별 아이콘 색 map", () => {
    const src = read(TOASTER);
    expect(src).toMatch(/VARIANT_ICON/);
    expect(src).toMatch(/text-emerald-600/);
    expect(src).toMatch(/text-amber-600/);
    expect(src).toMatch(/text-rose-600/);
  });
  it("progress bar + info(progress)는 닫기 없음", () => {
    const src = read(TOASTER);
    expect(src).toMatch(/role="progressbar"/);
    expect(src).toMatch(/const showClose = variant !== "info"/);
  });
});

describe("§action-toast — labToast 헬퍼 규칙", () => {
  it("5 API + 타입별 duration(성공 3초·undo 5초·부분/오류/진행 수동)", () => {
    const src = read(LAB);
    for (const a of ["success:", "partial:", "error:", "undo:", "progress:"]) expect(src).toContain(a);
    expect(src).toMatch(/success: 3000/);
    expect(src).toMatch(/undo: 5000/);
    expect(src).toMatch(/warning: Infinity/);
    expect(src).toMatch(/error: Infinity/);
  });
  it("액션은 dismiss 확보 후 update로 주입(순환 회피) + 최대 2개", () => {
    const src = read(LAB);
    expect(src).toMatch(/t\.update\(\{ id: t\.id, action: actionEls/);
    expect(src).toMatch(/actions\.slice\(0, 2\)/);
  });
  it("progress 는 update/close 반환", () => {
    const src = read(LAB);
    expect(src).toMatch(/update: \(u:/);
    expect(src).toMatch(/close: t\.dismiss/);
  });
});
