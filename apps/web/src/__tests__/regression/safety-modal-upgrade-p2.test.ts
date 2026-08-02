/**
 * §safety-modal-upgrade P2 (호영님 2026-07-04) — AI 큐 "완료 처리" no-op 제거.
 * 로컬 completedQueueIds state 토글은 저장 0(새로고침 리셋) = canonical truth 위반/가짜완료.
 * 완료는 MSDS·점검 canonical 파생으로만 큐 이탈. nextAction CTA·모바일 인라인 확장은 보존(회귀 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/safety/page.tsx"), "utf8");

describe("§safety-modal-upgrade P2 — no-op 완료버튼 제거", () => {
  it("completedQueueIds 로컬 완료 state 전면 제거", () => {
    expect(PAGE).not.toMatch(/completedQueueIds/);
    expect(PAGE).not.toMatch(/setCompletedQueueIds/);
  });
  it('"완료 처리" 버튼(title) 제거', () => {
    expect(PAGE).not.toMatch(/title="완료 처리"/);
  });
  it("회귀 0 — AI 큐 nextAction CTA(setSelectedItemId) 보존", () => {
    expect(PAGE).toMatch(/setSelectedItemId\(q\.id\)/);
    expect(PAGE).toMatch(/\{q\.nextAction\}/);
  });
  // supersede(§msds-registration 실 업로드 전환): 파일명을 폼 state(msdsForm.fileName)에 복사해
  //   두던 방식 → File 객체(msdsFile) 단일 소스로 정리. 파일명·용량은 msdsFile 에서 직접 읽는다.
  //   잠그는 계약은 프로퍼티 접근 표기가 아니라 **첨부 파일이 사용자에게 확인 가능하게 표시될 것**.
  it("회귀 0 — 첨부 파일 확인 표시 보존(파일명·용량)", () => {
    expect(PAGE).toMatch(/CheckCircle2/);
    expect(PAGE).toMatch(/\{msdsFile\.name\}/);
    expect(PAGE).toMatch(/msdsFile\.size \/ 1024 \/ 1024/);
  });
});
