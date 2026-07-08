/**
 * §inbound-quarantine-temp-exclude — P3 UI sentinel.
 *
 * 입고 상세(데스크탑 shell + 모바일 시트)에서 격리/온도 표시를 제거하고,
 * "문서 해소" CTA를 실제 첨부 모달(ReceivingDocAttachModal)에 wiring했는지 강제.
 * (호영님 2026-07-02 결정, P3 2026-07-03)
 *
 * KEEP 경계: stockPosition quarantine_constrained(재고 lifecycle) 및 만료 lot 폐기 문맥은 범위 밖.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const read = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");

const PAGE = "app/dashboard/receiving/[receivingId]/page.tsx";
const MOBILE = "components/receiving/mobile-receiving-detail.tsx";
const MODAL = "components/receiving/receiving-doc-attach-modal.tsx";

describe("§inbound-quarantine-temp-exclude P3 — 격리/온도 표시 제거", () => {
  it("데스크탑 lot 테이블에서 격리 컬럼(quarantineLabel/Tone) 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/quarantineLabel/);
    expect(src).not.toMatch(/QUARANTINE_TONE_COLOR/);
  });
  it("재고 반영 결과에서 격리 lot/수량 StatCell 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/격리 lot/);
    expect(src).not.toMatch(/격리 수량/);
    expect(src).not.toMatch(/rel\.quarantinedLots/);
  });
  it("헤더 riskBadge·blocker에서 격리 항목 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/"격리 품목"/);
    expect(src).not.toMatch(/격리 중 — 판정 필요/);
  });
  it("모바일 LOT 요약에서 격리 검수대기 배지 제거 + 스텝퍼 quarantine_active 미참조", () => {
    const src = read(MOBILE);
    expect(src).not.toMatch(/quarantinedLots/);
    expect(src).not.toMatch(/quarantine_active/);
  });
});

describe("§inbound-quarantine-temp-exclude P3 — 문서 해소 첨부 wiring (dead button 해소)", () => {
  it("page가 ReceivingDocAttachModal을 렌더하고 onResolveDocs를 command에 주입", () => {
    const src = read(PAGE);
    expect(src).toMatch(/ReceivingDocAttachModal/);
    expect(src).toMatch(/onResolveDocs:\s*\(\)\s*=>\s*setDocModalOpen\(true\)/);
    expect(src).toMatch(/store\.attachReceivingDocument\(/);
  });
  it("모달이 실제 store 첨부 액션(onAttach)에 연결 — placeholder success 없음", () => {
    const src = read(MODAL);
    // §receiving-doc-attach-v2 — 버튼은 handleAttach 래퍼 경유(§action-toast 정합), 래퍼 내부가 onAttach 실 호출.
    expect(src).toMatch(/onClick=\{\(\) => handleAttach\(line\.id, type\)\}/);
    expect(src).toMatch(/onAttach\(lineId, docType, lotId\)/);
    expect(src).not.toMatch(/quarantineStatus|quarantineLabel|격리/);
  });
});

describe("§inbound-quarantine-temp-exclude P3 — 회귀 0 (기존 게이트 보존)", () => {
  it("문서 미첨부·검수 blocker는 유지", () => {
    const src = read(PAGE);
    expect(src).toMatch(/필수 문서 미첨부/);
    expect(src).toMatch(/model\.inspection\.failed/);
  });
  it("lot 테이블의 문서·반영 컬럼은 유지", () => {
    const src = read(PAGE);
    expect(src).toMatch(/lot\.documentCoverage/);
    expect(src).toMatch(/lot\.postingState/);
  });
});
