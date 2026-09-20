/**
 * §support-center P1 (호영님 2026-07-05) — 통합 검색 바 승격 + ⌘K 명령 팔레트.
 * §0 헤더 아래 통합 검색("무엇을 도와드릴까요?") · §1 ⌘K/Ctrl+K 오버레이(실시간 필터, Esc·배경 닫힘,
 * reduced-motion). 🔁 티켓 그룹·ticketId 딥링크는 2026-09-20 은퇴 — 아래 승계 주석 참조(지어낸 티켓이 소비처였다).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P1 — 통합검색 + ⌘K 팔레트", () => {
  it("§0 통합 검색 바 승격", () => {
    expect(PAGE).toMatch(/무엇을 도와드릴까요/);
  });
  it("§1 ⌘K/Ctrl+K 오버레이 + 결과 3그룹 + reduced-motion", () => {
    expect(PAGE).toMatch(/e\.metaKey \|\| e\.ctrlKey/);
    expect(PAGE).toMatch(/cmdkResults/);
    expect(PAGE).toMatch(/motion-reduce:/);
  });
  /* 🔁 은퇴→승계 (§support-center-fabricated-tickets · 2026-09-20)
   *   구 계약: ticketId 딥링크가 **실 소비**된다(dead param 아님) — 소비처는 MOCK_TICKETS 상세 선택이었다.
   *   실상  : 소비 대상이 지어낸 티켓 2건이었다. 티켓을 지우자 param 이 가리킬 것이 없어졌다.
   *   신 계약: **읽지도 쓰지도 않는다**(dead param 0) — 취지(dead param 금지)는 그대로이고 방향만 뒤집혔다.
   *            support-center-fabricated-tickets.test.ts ③ 이 승계한다(⌘K 티켓 그룹 은퇴 포함).
   *   조회 API 가 생겨 딥링크를 되살릴 때는 이 계약을 실데이터 축으로 복원한다. */
  it("회귀 0 — handleTabChange 보존 + orphan globalSearch 0", () => {
    expect(PAGE).toMatch(/const handleTabChange/);
    expect(PAGE).not.toMatch(/globalSearch/);
  });
});
