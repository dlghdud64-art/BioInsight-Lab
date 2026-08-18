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
  /* 🛑 은퇴 (2026-08-17 · §receiving-detail-redesign)
   *    MobileReceivingDetail 은 실데이터 상세의 단일 컴포넌트 반응형으로 대체됐고
   *    파일 자체가 삭제됐다(importer 0). read() 가 모듈 스코프에서 돌기 때문에
   *    남겨두면 파일 로드 자체가 실패한다.
   *    승계: receiving-detail-realdata.test.ts — 격리 표기 0 은 신 페이지에서 잠근다. */
});

describe("§inbound-quarantine-temp-exclude P3 — 문서 해소 첨부 wiring (dead button 해소)", () => {
  /* 🛑 은퇴 (2026-08-17 · §receiving-detail-redesign P1~P3)
   *    구 계약: 데모 페이지가 ReceivingDocAttachModal 을 직접 렌더하고 onResolveDocs 로 연결.
   *    현행:    상세가 실데이터로 전환되며 문서 경로가 **일괄 처리 모달의 문서 스텝**으로 이관.
   *    🛑 정책("문서 미첨부가 화면에 보이고 첨부 경로가 있다")은 살아 있고 **수단만 바뀌었다.**
   *       승계: receiving-detail-realdata.test.ts — 문서 카드 실재 + 모달 docType coa/invoice 스텝. */
  it("모달이 실제 store 첨부 액션(onAttach)에 연결 — placeholder success 없음", () => {
    const src = read(MODAL);
    // supersede(87e6bfae · §receiving-doc-attach-canonical): 데모 store 콜백(onAttach/handleAttach)
    //   → 실 파일 업로드(Supabase storage + ReceivingDocument row)로 이관. 잠그는 계약은
    //   콜백 이름이 아니라 **첨부가 실제 영속 경로를 탈 것(placeholder success 0)**.
    expect(src).toMatch(/uploadReceivingDocumentWithProgress\(/);
    expect(src).toMatch(/type="file"/);
    expect(src).not.toMatch(/quarantineStatus|quarantineLabel|격리/);
  });
});

/* 🛑 describe 자체를 제거한다 — 위 은퇴로 it 이 0이 됐고,
 *    빈 describe 는 vitest 가 "No test found in suite" 로 실패시킨다.
 *    승계는 receiving-detail-realdata.test.ts 가 진다. */
