/**
 * §inventory-notes-erase (2026-09-11 prod 실측 · P1) —
 * **비고를 지우면 지워진다.** "안 넘김" 과 "비움" 은 다른 사건이다.
 *
 * ── 결함 (sandbox 가 prod 에서 직접 밟았다) ──
 * ```
 * 비고 지우고 저장 → 토스트 성공 · updatedAt 04:24:19 갱신 · MutationAuditEvent success 기록
 *                  → notes 는 그대로 "audit-smoke 20260911 …"
 * ```
 * 원인 `api/inventory/[id]/route.ts:195`:
 *     let updatedNotes = notes || existingInventory.notes || '';
 * 빈 문자열은 falsy 라 기존 값으로 되돌아간다. DB 쓰기는 일어나고 성공 토스트도 뜨는데
 * 의도한 변경만 안 된다 — dead button 보다 나쁘다. 사용자가 성공했다고 믿는다.
 * `||` 폴백이 "비움" 을 "안 넘김" 으로 삼키는 형태이고, 이 세션이 반복해 온 계열이다
 * (`countUsageFor` 선택 인자 · `organizationId` 유도).
 *
 * ── 계약 ──
 *   undefined        → 기존 유지 (안 넘김)
 *   "" · null        → null     (비움)
 *   "새 값"          → "새 값"
 *
 * ── 이 파일이 안 보는 것 (조항 11) ──
 *   1. 클라이언트가 빈 칸을 `""` 로 보내는지 `undefined` 로 떨구는지 — 화면 축이다.
 *      이 테스트는 서버 해석만 잠근다.
 *   2. 공백만 있는 값("   ")의 처리 — 계약에 없다. 지금은 그대로 저장된다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveNotesUpdate } from "@/lib/inventory/notes-update";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");

describe("§inventory-notes-erase · 비움과 안 넘김을 가른다", () => {
  it("🛑 빈 문자열은 비움이다 → null (기존 값으로 되돌아가지 않는다)", () => {
    expect(resolveNotesUpdate("", "audit-smoke 20260911")).toBeNull();
  });

  it("🛑 null 도 비움이다 → null", () => {
    expect(resolveNotesUpdate(null, "audit-smoke 20260911")).toBeNull();
  });

  it("undefined 는 안 넘김이다 → 기존 유지 (회귀 0)", () => {
    expect(resolveNotesUpdate(undefined, "기존 비고")).toBe("기존 비고");
  });

  it("새 값은 그대로 저장한다 (회귀 0)", () => {
    expect(resolveNotesUpdate("새 비고", "기존 비고")).toBe("새 비고");
  });

  it("입고일 병기 · 안 넘김 + date 면 기존 뒤에 붙인다 (회귀 0)", () => {
    expect(resolveNotesUpdate(undefined, "기존", "2026-09-11")).toBe("기존\n[입고일: 2026-09-11]");
    // 같은 날짜는 두 번 붙이지 않는다
    expect(resolveNotesUpdate(undefined, "기존\n[입고일: 2026-09-11]", "2026-09-11")).toBe(
      "기존\n[입고일: 2026-09-11]",
    );
  });

  it("🔑 라우트가 이 함수를 쓴다 · 옛 `||` 폴백이 남아 있지 않다 (배선)", () => {
    const code = stripComments(
      readFileSync(join(WEB_ROOT, "src/app/api/inventory/[id]/route.ts"), "utf8"),
    );
    expect(code).toMatch(/resolveNotesUpdate\s*\(/);
    expect(code).not.toMatch(/notes\s*\|\|\s*existingInventory\.notes/);
  });
});
