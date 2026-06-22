/**
 * §09 시안 하단 차용(호영님 라이브 대조) — 공급사 발송 검토 ready-state 시안 정합.
 *   ① 2상태 배너: ready 시 ✓ 초록 원 + 설명문("공급사 선별 · 연락 채널 · 메시지 · 견적 연결까지 모두 확인됐습니다.")
 *   ② 받는 공급사 카드: 확인된 수신처 초록 ✓ 원 + "연락처 확인" 인라인 배지 + 우측 "전송 대상" + 공급사별 컬러 아바타(왼쪽 이미지)
 *   ③ 풋터: ready 시 "미리보기·수신자 검증 완료" 좌측 상태문
 *   honesty: 이메일 무효 시 초록 ✓/전송 대상 미표시("확인 필요"/"보류").
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"),
  "utf8",
);

describe("§09 시안 — 발송 검토 ready-state 하단 차용", () => {
  it("2상태 배너: ready ✓ 초록 원 + 설명문", () => {
    expect(SRC).toContain("공급사 선별 · 연락 채널 · 메시지 · 견적 연결까지 모두 확인됐습니다.");
    expect(SRC).toMatch(/rounded-full bg-emerald-500 text-white/);
  });

  it("공급사 카드: ✓원 + 인라인 '연락처 확인' 배지 + '전송 대상' + 컬러 아바타", () => {
    expect(SRC).toContain("avatarTone");
    expect(SRC).toContain("연락처 확인");
    expect(SRC).toContain("전송 대상");
    // 컬러 팔레트(왼쪽 이미지 차용)
    expect(SRC).toMatch(/avatarPalette = \[/);
  });

  it("honesty: 이메일 무효 시 ✓/전송 대상 미표시 — '보류'/'확인 필요'", () => {
    expect(SRC).toMatch(/emailValid && \(/); // ✓ 원은 emailValid gate
    expect(SRC).toContain("보류");
    expect(SRC).toContain("확인 필요");
  });

  it("풋터: ready 시 '미리보기·수신자 검증 완료' 좌측 상태문", () => {
    expect(SRC).toContain("미리보기·수신자 검증 완료");
    expect(SRC).toMatch(/sendReadiness === "ready" && !sentTracking/);
  });
});
