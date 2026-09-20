/**
 * §support-center P4 (호영님 2026-07-05) — 진행 단계·직접문의 배너 + CSRF fix.
 * 직접 문의 배너(/support 실배선). 🛑 handleSubmit /api/support/inquiry raw fetch → csrfFetch(전역 CSRF 게이트).
 * 🔁 2026-09-20: 파이프라인은 실데이터(ContactInquiry.status)로 복원 · SLA·answerBody 는 저장 열이 없어 미복원.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P4 — 티켓 파이프라인·SLA·답변본문·CSRF", () => {
  it("§4 CSRF fix — handleSubmit csrfFetch(raw fetch 제거, 403 해소)", () => {
    expect(PAGE).toMatch(/import \{ csrfFetch \} from "@\/lib\/api-client"/);
    expect(PAGE).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    // 🛑 창을 handleSubmit 블록으로 좁힌다(2026-09-20). 파일 전체에 걸면 **읽기**까지 잡는다 —
    //    접수 내역 조회 GET 은 raw fetch 가 맞고(CSRF 는 변경 요청 보호다) 그걸 RED 로 만들면
    //    "계약을 지키는 구현이 RED" 가 된다(§4원칙 ⑤ 판별: 고칠 대상은 검사였다).
    const from = PAGE.indexOf("const handleSubmit = async");
    const to = PAGE.indexOf("\n  };", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    const submitBlock = PAGE.slice(from, to);
    expect(submitBlock).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(submitBlock).not.toMatch(/await fetch\(/);
  });
  /* 🔁 은퇴 → 역계약 → **실데이터 복원** (2026-09-20 · 같은 날 두 번 움직였다)
   *
   *   구 계약: 티켓 상세가 상태 파이프라인(접수→배정→확인→답변→완료) · SLA 배지 · answerBody 를
   *            **실제로 노출**한다("담당자가 답변을 등록했습니다" 요약 대체).
   *   실상  : 그 셋이 그리던 대상은 티켓이 아니라 **하드코딩 2건(MOCK_TICKETS)** 이었다
   *            (§support-center-fabricated-tickets · c3f046fb 에서 제거).
   *   복원  : 릴레이가 조회 API 신설을 승인해(GET /api/support/inquiry) 파이프라인은 **실데이터 축**으로
   *            돌아왔다 — 아래 it 이 그것을 다시 문다. 단계는 저장값에 맞춰 4개다
   *            (ContactInquiry.status = received · reviewed · replied · closed).
   *            🛑 "배정" 단계는 **복원하지 않는다** — 저장하는 값이 없다. 5단계로 되돌리면 한 칸이 지어낸 것이 된다.
   *   미복원: SLA 배지 · answerBody. 열이 없어 지어내야만 그릴 수 있다.
   *            부활 금지는 support-center-fabricated-tickets ② 가 문다. 열이 생기면 그때 되살린다. */
  it("§4 진행 단계 = 저장된 status 파생(4단계 · 계단식 fade-in · reduced-motion)", () => {
    expect(PAGE).toMatch(/const INQUIRY_STAGES = \["접수", "확인", "답변", "완료"\]/);
    expect(PAGE).toMatch(/function inquiryStageIndex\(status: string\)/);
    // 저장값 4종이 전부 매핑된다 — 하나라도 빠지면 그 상태가 "접수" 로 뭉개진다.
    // 🛑 창을 그 함수 본문으로 좁힌다 — 파일 전체에 걸면 바로 아래 inquiryStatusLabel 의 같은
    //    문자열이 **대신 매칭**해 매핑을 지워도 GREEN 이었다(4원칙 ④ · P14 실측).
    const sFrom = PAGE.indexOf("function inquiryStageIndex");
    const sTo = PAGE.indexOf("\n}", sFrom);
    expect(sFrom).toBeGreaterThan(-1);
    const stageFn = PAGE.slice(sFrom, sTo);
    expect(stageFn).toMatch(/"closed"/);
    expect(stageFn).toMatch(/"replied"/);
    expect(stageFn).toMatch(/"reviewed"/);
    // 상세가 그 파생값을 실제로 쓴다(상수를 그리지 않는다)
    expect(PAGE).toMatch(/inquiryStageIndex\(selectedInquiry\.status\)/);
    expect(PAGE).toMatch(/INQUIRY_STAGES\.map\(/);
    expect(PAGE).toMatch(/animationDelay:/);
    expect(PAGE).toMatch(/motion-reduce:/);
  });
  it("§4 직접 문의 배너", () => {
    expect(PAGE).toMatch(/찾는 답이 없/);
  });
});
