/**
 * §analytics-signal-honesty (2026-09-22 · 호영님 P1) · **지출 분석 화면이 자기 동작을 사실대로 말한다.**
 *
 * ── 왜 (측정 5건) ──
 *   ⓐ 「실시간 이상 지출 로그」 — 실시간이 아니다. 데이터는 5분 캐시(useQuery staleTime)이고 푸시·구독이 없다.
 *   ⓑ 「N New Signals」 + 점멸(animate-ping) — New 가 아니다. 매 로드마다 다시 계산한 **개수**이고
 *      읽음 상태도 직전 시점과의 비교도 없다. 기준선이 없으면 「새로 생긴 것」 을 말할 수 없다.
 *      점멸은 「방금 도착」 신호인데 그 사건 자체가 없다.
 *   ⓒ 「전체 내역 다운로드」 — 다운로드가 아니라 **이동**이었고, 목적지(구매 운영)는 지출 내역이 아니라
 *      견적→발주 전환 큐였다. 두 거짓이 겹쳐 있었다.
 *   ⓓ AI 버튼 비활성 사유 「완료된 발주 1건 이상 필요」 — 실제 조건은 `dataInsufficient = !hasMonthlyData`,
 *      즉 최근 6개월 **지출**이 0 이다(발주 건수가 아니다). 화면이 틀린 사유를 말했고,
 *      analytics-loading-ux ③ 이 그 틀린 문안을 잠그고 있었다(같은 커밋에서 실제 정책으로 앵커 이동).
 *   ⓔ 빈 상태 KPI 4의 고정폭 회색 막대(30·20·25·40%) — 데이터가 0 인데 진행률처럼 읽혔고,
 *      예산이 등록된 경우엔 숫자(실 소진율)와 막대(30%)가 서로 다른 말을 했다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 「실시간」·「New」·점멸 0 — 센 것을 센 대로 말한다(표시 N건)
 *   ② 라벨이 동작과 같다 — 다운로드라고 말하지 않고, 실제로 내역·내보내기가 있는 화면으로 보낸다
 *   ③ 비활성 사유 = 실제 조건(최근 6개월 지출)
 *   ④ 빈 상태에 가짜 진행률 막대 0
 *
 * ── 자기 한계 ──
 *   1. 「AI 리포트 생성」 라벨(실 endpoint 는 한 단락 요약을 낸다)은 **보류**다 —
 *      §analytics-tabs comp fixture(시안 정본 3곳)와 §analytics-ai-report-sian 이 그 문자열을 잠그고 있어
 *      바꾸면 호영님 시안 결정을 대체하게 된다. 상신 후 판정 대기(이 파일은 그 문자열을 단언하지 않는다).
 *   2. anomalies 규칙 자체(반복 구매·고액 단건 임계)의 타당성은 보지 않는다 — 별건.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const PAGE = stripComments(readFileSync(join(SRC, "app/dashboard/analytics/page.tsx"), "utf8"));

/** 이상 지출 카드 블록 — 제목부터 목록 시작까지(창은 요소 블록으로) */
function signalCard(): string {
  const at = PAGE.indexOf("이상 지출 점검");
  const end = PAGE.indexOf("anomalies.length > 0 ?", at);
  return at < 0 || end < 0 ? "" : PAGE.slice(at, end);
}

describe("§analytics-signal-honesty · 화면이 자기 동작을 사실대로 말한다", () => {
  it("① 「실시간」·「New」·점멸 0 · 센 것을 센 대로 (역계약)", () => {
    expect(PAGE).not.toMatch(/실시간 이상 지출 로그/);
    expect(PAGE).not.toMatch(/New Signals/);
    expect(PAGE).not.toMatch(/Automated Risk Monitoring/);
    const card = signalCard();
    expect(card.length).toBeGreaterThan(0);
    expect(card).not.toMatch(/animate-ping/);
    expect(card).toMatch(/표시 \{totalSignals\}건/);
    expect(card).toMatch(/반복 구매 · 고액 단건 규칙 점검/);
  });

  it("② 라벨이 동작과 같다 · 이동은 이동이라고 말한다", () => {
    expect(PAGE).not.toMatch(/전체 내역 다운로드/);
    expect(PAGE).toMatch(/<Link href="\/dashboard\/reports"[^>]*>\s*보고서에서 전체 내역 보기/);
    // 지출 내역이 아닌 화면(구매 운영 = 전환 큐)으로 보내던 옛 목적지
    expect(PAGE).not.toMatch(/<Link href="\/dashboard\/purchases"[^>]*>\s*전체 내역/);
  });

  it("③ 비활성 사유 = 실제 조건(최근 6개월 지출)", () => {
    expect(PAGE).toMatch(/const dataInsufficient = !hasMonthlyData;/);
    const reason = PAGE.slice(PAGE.indexOf("ai-report-reason-${variant}`}"));
    expect(reason).toMatch(/최근 6개월 지출 기록 필요/);
    expect(reason).not.toMatch(/완료된 발주/);
  });

  it("④ 빈 상태에 가짜 진행률 막대 0 · 힌트 문구는 보존", () => {
    for (const w of ["30%", "20%", "25%", "40%"]) {
      expect(PAGE, `ghost bar ${w}`).not.toMatch(
        new RegExp('bg-slate-200" style=\\{\\{ width: "' + w + '" \\}\\}'),
      );
    }
    // §11.244-sian (D) 의 「언제 채워지는지」 힌트는 남는다(빈 상태 설명은 참이다)
    expect(PAGE).toMatch(/예산 등록 시 채워집니다/);
    expect(PAGE).toMatch(/발주 3건\+ 누적 시 산출/);
  });
});
