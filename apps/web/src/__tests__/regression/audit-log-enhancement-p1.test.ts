/**
 * §audit-log-enhancement P1 (호영님 2026-07-04) — 감사 신뢰 배지 바.
 * 원 명제: **fake compliance 금지** — hash chain 이 없으므로 "해시 검증됨" 을 주장하지 않는다.
 *
 * 🛑 승계 (§audit-surface-divergence · 호영님 2026-09-12): 원 판본은 그 명제를 지키려다
 *   append-only · Part11 정합 **주장을 강제**하고 있었다(toMatch 3건). 그런데 2026-09-11 실측으로
 *   이 화면이 읽는 두 테이블(AuditLog · ActivityLog)에 최근 2일 0행 · 안 읽는 두 테이블
 *   (MutationAuditEvent · DataAuditLog)에 16행이 드러났다 — 오늘의 데이터 변경이 이 화면에
 *   한 건도 들어오지 않는다. 그 상태의 「21 CFR Part 11 정합」 은 허위 표시다.
 *   → 같은 명제(근거 없는 규제 주장 금지)를 **주장 부재**로 뒤집어 잇는다.
 *   되살리려면 먼저 이 화면이 실제 쓰기 감사를 읽어야 한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/audit/page.tsx"), "utf8");
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§audit-log-enhancement P1 — 신뢰 배지 바", () => {
  it("신뢰 바 존재 + 사실 주장만(KST 고정 표기)", () => {
    expect(CODE).toMatch(/data-testid="audit-trust-bar"/);
    // 이 화면이 실제로 하는 일 — timeZone "Asia/Seoul" 고정 표기
    expect(CODE).toMatch(/KST 고정/);
  });
  it("🛑 근거 없는 규제·보안 주장 0 (해시 검증 · 변조 방지 · Part 11 정합 · append-only 배지)", () => {
    const bar = CODE.match(/audit-trust-bar[\s\S]{0,700}?<\/div>/)?.[0] ?? "";
    expect(bar, "신뢰 바를 못 찾았다(수집 실패는 조용한 통과가 된다)").not.toBe("");
    expect(CODE).not.toMatch(/해시 검증/);
    expect(bar).not.toMatch(/21 CFR|Part 11/);
    expect(bar).not.toMatch(/변조 방지/);
    expect(bar).not.toMatch(/수정·삭제 불가/);
  });
  it("중립 톤 — 신뢰 바에 빨강/카테고리 배경색 미사용", () => {
    const bar = CODE.match(/audit-trust-bar[\s\S]{0,600}/)?.[0] ?? "";
    expect(bar).not.toMatch(/bg-red|text-red|bg-\[#c8324f\]/);
  });
});
