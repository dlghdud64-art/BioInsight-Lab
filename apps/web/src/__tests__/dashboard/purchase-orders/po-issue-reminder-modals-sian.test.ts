/**
 * §시안-PO-Phase2 #po-issue-reminder-modals-sian
 *
 * 발주 관리 page.tsx 시안 Phase 2 — 발행 모달(IssueModal) + 리마인더
 * 모달(ReminderModal) 실 endpoint 연결 RED guard (source-regex).
 *
 * 핵심 가치 = "지금 내 차례" PO 의 공급사 발행 확인 모달 + "공급사 응답
 * 대기" PO 의 리마인더 1회 발송 모달. 둘 다 실 endpoint(send-email /
 * order-followup) 연결, 자동발송 예약은 미구현(스케줄러 backend 부재).
 *
 * 검증 범위:
 *   1. 발행 모달 — 발행 준비 배너 + 발주서 PDF doc 행 + "발행하고 이메일
 *      발송" 버튼 존재.
 *   2. 리마인더 모달 — 무응답 배너 + order-followup 초안 + "리마인더 발송"
 *      (1회) 존재.
 *   3. 자동발송 예약 미도입 — "자동 발송 예약" / "pm-auto" / "setEvery" 부재.
 *   4. dead button 0 — 발송 = 실 mutation(emailMutation / reminderMutation),
 *      vendor.email 없으면 disabled(!vendorEmail), 가짜 success 부재.
 *   5. 회귀 0 — Phase1 섹션(지금 내 차례 / 공급사 응답 대기 / 입고로 인계) ·
 *      AiAnalysisPanel(canonical) · pdfMutation / emailMutation ·
 *      order-resolve query 보존.
 *   6. 하드코딩 count 0 — 모달에 리터럴 'N건' / 금액 하드코딩 부재.
 *
 * Source-level guards only (readFileSync + regex). DB / mount 없음.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const PAGE = "src/app/dashboard/purchase-orders/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§시안-PO-Phase2 — page.tsx 존재", () => {
  it("page.tsx 존재", () => {
    expect(existsSync(join(REPO_ROOT, PAGE))).toBe(true);
  });
});

describe("§시안-PO-Phase2 발행 모달(IssueModal)", () => {
  const src = read(PAGE);

  it("IssueModal 컴포넌트 정의 + Dialog 사용", () => {
    expect(src).toMatch(/function IssueModal/);
    expect(src).toMatch(/from "@\/components\/ui\/dialog"/);
  });

  it("발행 준비 배너 존재", () => {
    expect(src).toMatch(/발행 준비/);
  });

  it("발주서 PDF doc 행 — 미리보기 = generate-pdf(pdfMutation) 재사용", () => {
    expect(src).toMatch(/미리보기/);
    // 미리보기는 기존 pdfMutation(generate-pdf) 재사용 — 중복 mutation 0.
    expect(src).toMatch(/pdfMutation/);
  });

  it("발행 트리거 — 공급사 발행 버튼이 모달 open(setIssueModalOpen)", () => {
    expect(src).toMatch(/setIssueModalOpen\(true\)/);
  });

  it("'발행하고 이메일 발송' 버튼 = 기존 emailMutation 재사용", () => {
    expect(src).toMatch(/발행하고 이메일 발송/);
    expect(src).toMatch(/emailMutation\.mutate/);
  });
});

describe("§시안-PO-Phase2 리마인더 모달(ReminderModal)", () => {
  const src = read(PAGE);

  it("ReminderModal 컴포넌트 정의", () => {
    expect(src).toMatch(/function ReminderModal/);
  });

  it("무응답 경과 배너 존재", () => {
    expect(src).toMatch(/응답 없음|응답 대기/);
  });

  it("order-followup 자동 초안(실 생성) 호출", () => {
    expect(src).toMatch(/\/api\/ai-actions\/generate\/order-followup/);
  });

  it("'리마인더 발송' 버튼 = send-email 1회(reminderMutation) 재사용", () => {
    expect(src).toMatch(/리마인더 발송/);
    expect(src).toMatch(/reminderMutation\.mutate/);
    expect(src).toMatch(/reminderMutation\s*=\s*useMutation/);
  });

  it("리마인더 트리거 — 공급사 대기 row 버튼이 모달 open(setReminderModalOpen)", () => {
    expect(src).toMatch(/setReminderModalOpen\(true\)/);
  });
});

describe("§시안-PO-Phase2 honesty — 자동발송 예약 미도입", () => {
  const src = read(PAGE);

  it("자동 발송 예약 / pm-auto / setEvery 부재", () => {
    // 주석 설명 텍스트("자동발송 예약 없음", "pm-auto 블록 생략")는 미구현 명시일 뿐 실 코드 아님 → 주석 제거 후 코드만 검사.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/자동 발송 예약|pm-auto|setEvery/);
  });

  it("가짜 스케줄러 endpoint(send-reminder / schedule) 부재", () => {
    expect(src).not.toMatch(/send-reminder/);
    expect(src).not.toMatch(/auto-?remind|autoSend|scheduleReminder/i);
  });

  it("발송 간격(interval/hours every) 토글 부재", () => {
    expect(src).not.toMatch(/reminderInterval|sendEvery|intervalHours/);
  });
});

describe("§시안-PO-Phase2 dead button 0 — 실 mutation + disabled 가드", () => {
  const src = read(PAGE);

  it("발행 모달 발송 = 실 send-email endpoint(가짜 success 부재)", () => {
    expect(src).toMatch(/send-email/);
    // placeholder success / no-op 금지 — alert success / setTimeout fake 부재.
    expect(src).not.toMatch(/alert\(["']발송 완료/);
    expect(src).not.toMatch(/fakeSuccess|mockSend|TODO.*발송/);
  });

  it("vendor.email 없으면 발행 발송 disabled(!vendorEmail)", () => {
    expect(src).toMatch(/!vendorEmail/);
    // 공급사 이메일 미설정 정직 표기.
    expect(src).toMatch(/공급사 이메일 미설정|공급사 이메일이 설정되지 않아/);
  });

  it("리마인더 발송 disabled — resolve 안 된 row(!resolvedOrderId)", () => {
    expect(src).toMatch(/reminderMutation\.isPending\s*\|\|\s*!resolvedOrderId/);
  });
});

describe("§시안-PO-Phase2 회귀 0 — Phase1 섹션 / canonical wiring 보존", () => {
  const src = read(PAGE);

  it("Phase1 섹션 헤더 보존(지금 내 차례 / 공급사 응답 대기 / 입고로 인계)", () => {
    expect(src).toMatch(/지금 내 차례/);
    expect(src).toMatch(/공급사 응답 대기/);
    expect(src).toMatch(/입고로 인계/);
  });

  it("AiAnalysisPanel(canonical AI) 보존", () => {
    expect(src).toMatch(/AiAnalysisPanel/);
  });

  it("pdf / email mutation + order-resolve query 보존", () => {
    expect(src).toMatch(/pdfMutation\s*=\s*useMutation/);
    expect(src).toMatch(/emailMutation\s*=\s*useMutation/);
    expect(src).toMatch(/generate-pdf/);
    expect(src).toMatch(/order-resolve/);
  });

  it("파이프라인 / 트리아지 KPI / StatusCountGrid / AppPageHeader 보존", () => {
    expect(src).toMatch(/발주 흐름/);
    expect(src).toMatch(/triageKpis/);
    expect(src).toMatch(/StatusCountGrid/);
    expect(src).toMatch(/AppPageHeader/);
  });
});

describe("§시안-PO-Phase2 canonical — 하드코딩 count / 금액 부재", () => {
  const src = read(PAGE);

  it("모달 영역 리터럴 'N건' / 금액 하드코딩 부재", () => {
    // 주석 제거 후 코드만 검사.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // 동적 보간({...}건)은 허용, 숫자 literal 바로 앞 "건"은 금지.
    expect(codeOnly).not.toMatch(/[>"\s]\d+건/);
    // 금액은 toLocaleString(canonical totalAmount)만 — 하드코딩 ₩숫자 금지.
    expect(codeOnly).not.toMatch(/₩\s*\d{3,}/);
  });
});
