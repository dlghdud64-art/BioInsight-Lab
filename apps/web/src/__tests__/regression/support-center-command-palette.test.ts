/**
 * §support-center P1 (호영님 2026-07-05) — 통합 검색 바 승격 + ⌘K 명령 팔레트.
 * §0 헤더 아래 통합 검색("무엇을 도와드릴까요?") · §1 ⌘K/Ctrl+K 오버레이(매뉴얼·문제해결·티켓 3그룹
 * 실시간 필터, Esc·배경 닫힘, reduced-motion). 티켓 결과 → ticketId 딥링크(TicketTab 상세 선택, dead param 아님).
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
  it("§1 ticketId 딥링크 = 실 소비(dead param 아님)", () => {
    expect(PAGE).toMatch(/params\.set\("ticketId"/);
    expect(PAGE).toMatch(/searchParams\??\.get\("ticketId"\)/);
    expect(PAGE).toMatch(/MOCK_TICKETS\.some\(\(t\) => t\.id === ticketIdParam\)/);
  });
  it("회귀 0 — handleTabChange 보존 + orphan globalSearch 0", () => {
    expect(PAGE).toMatch(/const handleTabChange/);
    expect(PAGE).not.toMatch(/globalSearch/);
  });
});
