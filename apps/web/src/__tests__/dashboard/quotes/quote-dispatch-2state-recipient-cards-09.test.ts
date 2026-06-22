/**
 * §quote-screen-sian P6.4 §09 4c #quote-dispatch-2state-recipient-cards
 *   발송 검토 모달 2상태 분기(공급사 있음/없음) + 받는 공급사 카드(아바타·이메일·확인 배지).
 *
 * §09 spec:
 *   - 공급사 있음(ready): 초록 "전송 준비 완료" 배너 + 받는 공급사 카드(아바타·이메일·확인 배지)
 *   - 공급사 없음(empty): 앰버 "공급사를 먼저 추가" 배너 + 전송 비활성(게이팅)
 *   - 공통: 메시지 미리보기(편집) + 응답 기한(1~90일)
 *
 * honesty lock: includedSuppliers 파생 재사용(저장 0) · 전송 게이팅(0곳=disabled+사유) 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WORKBENCH_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx",
);
const src = readFileSync(WORKBENCH_PATH, "utf8");

describe("§09 4c #1 — 2상태 배너", () => {
  it("공급사 유무로 2상태 배너 분기 (quote-dispatch-state-banner)", () => {
    expect(src).toContain('data-testid="quote-dispatch-state-banner"');
    expect(src).toContain('data-state="ready"');
    expect(src).toContain('data-state="empty"');
    expect(src).toContain("includedCount > 0 ?");
  });

  it("ready 초록 '전송 준비 완료' / empty 앰버 '공급사를 먼저 추가'", () => {
    expect(src).toContain("전송 준비 완료");
    expect(src).toContain("공급사를 먼저 추가");
    expect(src).toContain("border-emerald-200 bg-emerald-50 text-emerald-800");
    expect(src).toContain("border-yellow-200 bg-yellow-50 text-yellow-800");
  });
});

describe("§09 4c #2 — 받는 공급사 카드", () => {
  it("includedSuppliers 재사용 받는 공급사 카드 (아바타·이메일·확인 배지)", () => {
    expect(src).toContain('data-testid="quote-dispatch-recipient-cards"');
    expect(src).toContain('data-testid="quote-dispatch-recipient-card"');
    expect(src).toContain("받는 공급사");
    expect(src).toContain("includedSuppliers.map");
    expect(src).toContain("supplier.email");
  });

  it("연락처 확인 배지 (verified '연락처 확인' / invalid '확인 필요') — §09 시안 정합 문구", () => {
    // §09 시안 하단 — verified 배지 "연락처 확인됨"→"연락처 확인", invalid "연락처 확인 필요"→"확인 필요"/"보류".
    //   verified/invalid 2상태 구분(honesty: 이메일 무효 시 ✓ 대신 확인 필요)은 불변.
    expect(src).toContain("연락처 확인");
    expect(src).toContain("확인 필요");
  });
});

describe("§09 4c #3 — honesty 보존 (회귀 0)", () => {
  it("전송 게이팅 보존 (0곳=disabled + 사유)", () => {
    expect(src).toContain('data-testid="quote-dispatch-send-disabled"');
    expect(src).toContain('data-testid="quote-dispatch-send-gate"');
  });

  it("메시지 미리보기 + 응답 기한 보존", () => {
    expect(src).toContain('data-testid="quote-dispatch-message-preview"');
    expect(src).toContain("응답 요청 기한");
  });

  it("받는 공급사 카드는 includedSuppliers 파생 (저장 0)", () => {
    expect(src).toContain("const includedSuppliers = suppliers.filter");
  });
});

describe("§4c-rebloat — 후보 리스트 접기 (받는 공급사 카드 중복 해소, 호영님)", () => {
  it("선택됨(includedCount>0) 시 후보 리스트(Section 1·2) 접기 토글", () => {
    expect(src).toContain("candidatesExpanded");
    expect(src).toContain("setCandidatesExpanded");
    expect(src).toMatch(/includedCount === 0 \|\| candidatesExpanded/);
  });

  it("직접 입력(Section 3)·받는 공급사 카드는 접기와 무관하게 보존", () => {
    expect(src).toContain('data-testid="quote-dispatch-manual-supplier-panel"');
    expect(src).toContain('data-testid="quote-dispatch-recipient-cards"');
  });
});
