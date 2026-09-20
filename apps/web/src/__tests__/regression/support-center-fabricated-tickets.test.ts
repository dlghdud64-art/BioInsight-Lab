/**
 * §support-center-fabricated-tickets (2026-09-20 · 릴레이 판정) · **지원 센터는 없는 티켓을 그리지 않는다.**
 *
 * ── 왜 ──
 * 지원 티켓 탭이 `MOCK_TICKETS` 2건을 실제 접수 내역처럼 보여주고 있었다.
 *   TK-001  "답변 완료" · 답변 본문 "…재발 방지를 위해 발송 전 주소 유효성 검증 단계를 추가했습니다"
 *           → **하지 않은 조치를 고객에게 한 답변처럼** 보여준다. 이 세션에서 나온 지어낸 표시 중 가장 나쁜 형태다
 *             (예산·재고는 틀린 수였고, 이건 하지 않은 약속이다).
 *   TK-002  "확인 중" · "약 3시간 내 1차 답변 예정" → SLA 약속도 지어낸 값이었다
 *           (§support-center-sla-honesty 가 "당일 1차 확인" 을 이미 금지했는데 같은 약속이 데이터 모양으로 남아 있었다).
 * 그 사이 **진짜 접수는 화면에 없었다**: POST /api/support/inquiry → ContactInquiry 로 저장되고
 * 접수번호를 발급하는데(2026-09-20 prod 실측 3행 · service/received · 답변 완료 0), 읽는 API 가 없어
 * 사용자는 자기 문의를 다시 볼 수 없다. 즉 화면에는 **가짜만 있고 진짜는 없었다.**
 * 재고(§inventory-fabricated-figures) · 예산(§budget-fabricated-figures)에 이은 **같은 유형 세 번째**다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 지어낸 티켓이 없다 — 상수·식별자·고정 답변 문장 0.
 *   ② 데이터 출처 없이 목록·상세를 그리지 않는다 (역계약 승계 · 아래 참조).
 *   ③ dead param 0 — ticketId 딥링크를 읽지도 쓰지도 않는다 (역계약 승계 · 아래 참조).
 *   ④ 정직 표기가 남아 있다 — 「데이터 없음」 + 왜(저장은 되지만 조회 기능 없음) + 어디서(접수번호·고객 지원)
 *      + 실제 접수 배선(csrfFetch → /api/support/inquiry)은 무손상.
 *
 * ── 은퇴→승계 (지우기 전에 명제를 복원한다) ──
 *   구 §support-center P4 §4 : "티켓 상세는 상태 파이프라인(접수→배정→확인→답변→완료)·SLA 배지·answerBody 를
 *                               **실제로 노출**한다" → 그릴 대상이 사라졌으므로 **역계약**으로 승계(②).
 *                               정책("요약으로 뭉개지 말고 실제를 보여준다")은 불변이다 —
 *                               조회 API 가 생기면 그 계약을 **실데이터 축으로** 되살린다.
 *   구 §support-center P1 §1 : "ticketId 딥링크는 dead param 이 아니다(실 소비된다)" → 소비할 대상이
 *                               사라졌으므로 "읽지도 쓰지도 않는다" 로 승계(③). 제목의 취지(dead param 금지)는 같다.
 *   두 원본 파일에는 승계 위치를 적어 두었다(support-center-p4-ticket · support-center-command-palette).
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 지원 센터 밖. 같은 유형이 다른 화면에 남아 있다(2026-09-20 형태 조사: 렌더 도달 27파일 · 큐 참조).
 *      같은 파일 안에도 `GUIDE_ENTRIES` · `RUNBOOK_ITEMS` 처럼 **사람이 쓴 문서 상수**가 있다 —
 *      그건 데이터 위장이 아니라 매뉴얼이므로 이 검사의 대상이 아니다. 둘을 섞지 말 것.
 *   2. 서버가 내려주는 값의 진위. `/api/support/inquiry` 가 거짓 접수번호를 줘도 이 검사는 못 잡는다.
 *   3. 문장이 "그럴듯한지" 는 못 잰다. 리터럴인지 / 입력을 받는지만 본다.
 *   4. **조회 API 가 생겼을 때**는 이 파일의 ②③ 이 방해가 된다 — 그때는 지우지 말고
 *      위 "은퇴→승계" 를 거꾸로 밟아 실데이터 계약으로 되돌린다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const PAGE = "app/dashboard/support-center/page.tsx";

describe("§support-center-fabricated-tickets · 없는 티켓을 그리지 않는다", () => {
  it("① 지어낸 티켓이 없다 (상수·식별자·고정 답변 문장)", () => {
    const page = code(PAGE);
    expect(page).not.toMatch(/MOCK_TICKETS/);
    expect(page).not.toMatch(/TK-00\d/);
    // 고정 답변·고정 SLA 문장 — 하지 않은 조치를 한 것처럼 쓰지 않는다
    expect(page).not.toMatch(/재발 방지를 위해/);
    expect(page).not.toMatch(/주소 유효성 검증 단계를 추가/);
    expect(page).not.toMatch(/시간 내 1차 답변 예정/);
    expect(page).not.toMatch(/담당자가 답변을 등록했습니다/);
  });

  it("② 데이터 출처 없이 목록·상세를 그리지 않는다 (구 P4 §4 역계약 승계)", () => {
    const page = code(PAGE);
    expect(page).not.toMatch(/\bticketDetailPanel\b/);
    expect(page).not.toMatch(/\bselectedTicketId\b/);
    expect(page).not.toMatch(/\bTICKET_STAGES\b/);
    expect(page).not.toMatch(/\bslaHours\b/);
    expect(page).not.toMatch(/\banswerBody\b/);
    expect(page).not.toMatch(/\bgetStatusBadge\b/);
  });

  it("③ dead param 0 · ticketId 딥링크를 읽지도 쓰지도 않는다 (구 P1 §1 역계약 승계)", () => {
    const page = code(PAGE);
    expect(page).not.toMatch(/params\.set\("ticketId"/);
    expect(page).not.toMatch(/get\("ticketId"\)/);
    // ⌘K 결과 그룹도 함께 은퇴 — 검색할 대상이 없다
    expect(page).not.toMatch(/cmdkResults\.ticket\b/);
  });

  it("④ 정직 표기 + 실제 접수 배선 보존", () => {
    const page = code(PAGE);
    // 왜 비어 있는지 · 어디서 확인하는지
    expect(page).toMatch(/데이터 없음/);
    expect(page).toMatch(/접수번호/);
    expect(page).toMatch(/불러오는 기능은 아직 없습니다/);
    expect(page).toMatch(/고객 지원·문의/);
    // 접수 자체는 실제로 저장된다 — 이 배선을 끊으면 "접수됐다" 가 거짓이 된다
    expect(page).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(page).toMatch(/inquiryType/);
    // 접수 성공 토스트가 서버 접수번호를 그대로 쓴다(지어낸 번호 금지)
    expect(page).toMatch(/data\.referenceId/);
  });
});
