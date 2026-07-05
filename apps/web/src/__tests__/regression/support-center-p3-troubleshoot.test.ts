/**
 * §support-center P3 (호영님 2026-07-05) — 문제해결 칩 9→6 통합 + 안전 시나리오 상단 + 아코디언 + 티켓 프리필.
 * RUNBOOK_GROUP 매핑(item.category 유지, 필터·카운트·라벨만 그룹화=데이터 무손실). 3-arg 콜백 → ticketCategory
 * param → TicketTab 유효값만 자동 선택(dead param 아님). 색 중립 통일 + 안전만 muted amber(#b45821, CLAUDE §9).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P3 — 칩6 통합 + 안전 상단 + 아코디언 + 프리필", () => {
  it("§3 RUNBOOK_GROUP 매핑(데이터 무손실 그룹 필터/카운트)", () => {
    expect(PAGE).toMatch(/const RUNBOOK_GROUP: Record<string, string>/);
    expect(PAGE).toMatch(/RUNBOOK_GROUP\[r\.category\] === activeCategory/);
  });
  it("§3 아코디언 grid-rows 0fr→1fr + reduced-motion", () => {
    expect(PAGE).toMatch(/grid-rows-\[1fr\]" : "grid-rows-\[0fr\]/);
    expect(PAGE).toMatch(/transition-\[grid-template-rows\]/);
  });
  it("§3 티켓 프리필 3-arg 콜백 + ticketCategory 유효값 검증(dead param 아님)", () => {
    expect(PAGE).toMatch(/onCreateTicketFromRunbook\?: \(title: string, body: string, category\?: string\) => void/);
    expect(PAGE).toMatch(/params\.set\("ticketCategory", category\)/);
    expect(PAGE).toMatch(/TICKET_CATEGORIES\.some\(\(c\) => c\.value === ticketCategoryParam\)/);
  });
  it("§3 색상 — 안전 그룹만 muted amber(#b45821)", () => {
    expect(PAGE).toMatch(/group === "safety"\) return "bg-\[#fdf3ec\]/);
    expect(PAGE).toMatch(/text-\[#b45821\]/);
  });
});
