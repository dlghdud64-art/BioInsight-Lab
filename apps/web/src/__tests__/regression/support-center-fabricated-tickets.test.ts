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
 * 사용자는 자기 문의를 다시 볼 수 없었다. 즉 화면에는 **가짜만 있고 진짜는 없었다.**
 *
 * ── 이 파일의 2판 (같은 날 · 릴레이 지시로 계약이 한 번 더 움직였다) ──
 * 1판(c3f046fb)은 "그릴 데이터가 없으니 그리지 않는다" 였다. 릴레이가 곧바로 조회 API 신설을 승인해
 * 2판은 **"서버 데이터로만 그린다"** 가 된다. 두 판의 공통 명제는 하나다 — **화면은 저장된 것만 보여준다.**
 * 🛑 이건 "검사가 구현을 못 따라가서 앵커를 갱신" 한 경우가 **아니다**(§fixture 필드 지위 분리 위반형).
 *    계약 자체가 지시로 바뀌었고, 바뀐 근거를 여기에 적는다. 근거 없이 단언을 낮추면 그게 위반이다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 지어낸 티켓이 없다 — 상수·식별자·고정 답변 문장 0.
 *   ② 목록·상세는 **서버 데이터로만** 그린다 — 리터럴 티켓 배열 0 · 저장 열이 없는 표시(SLA·답변 본문) 부활 0.
 *   ③ 딥링크는 **실 소비**된다 — inquiryRef 를 쓰고 읽고, 실재하는 접수번호일 때만 연다(dead param 0).
 *   ④ 0건 · 실패 · 로딩을 뭉개지 않는다 + 접수 배선(csrfFetch → /api/support/inquiry · referenceId) 보존.
 *   ⑤ 조회 API 는 세션을 요구하고, 스코프가 본인이며, 수집 전용 열(ipAddress·userAgent)을 내려주지 않는다.
 *
 * ── 은퇴→승계 (지우기 전에 명제를 복원한다) ──
 *   구 §support-center P4 §4 : "상태 파이프라인·SLA 배지·answerBody 를 실제로 노출한다"
 *       → 파이프라인은 **실데이터 축으로 복원**됐다(ContactInquiry.status → INQUIRY_STAGES, 그쪽 파일이 다시 문다).
 *       → SLA·답변 본문은 **저장하는 열이 없어** 복원하지 않는다. 여기 ②가 부활 금지를 문다.
 *   구 §support-center P1 §1 : "ticketId 딥링크는 dead param 이 아니다"
 *       → 파라미터 이름만 inquiryRef 로 바뀌어 **실 소비로 복원**됐다(그쪽 파일이 다시 문다). 여기 ③이 겹으로 문다.
 *
 * ── 이 파일이 안 보는 것 (자기 한계 · 다음 검사의 시작점) ──
 *   1. 지원 센터 밖. 같은 유형이 다른 화면에 남아 있다(2026-09-20 형태 조사: 렌더 도달 27파일 · 큐 참조).
 *      같은 파일 안에도 `GUIDE_ENTRIES` · `RUNBOOK_ITEMS` 처럼 **사람이 쓴 문서 상수**가 있다 —
 *      매뉴얼이지 데이터 위장이 아니므로 이 검사의 대상이 아니다. 둘을 섞지 말 것.
 *   2. 서버가 내려주는 값의 진위. `/api/support/inquiry` 가 거짓 접수번호를 주면 이 검사는 못 잡는다.
 *   3. 문장이 "그럴듯한지" 는 못 잰다. 리터럴인지 / 입력을 받는지만 본다.
 *   4. **스코프의 정확성**. ⑤는 "세션 이메일로 좁힌다" 만 본다. ContactInquiry 에 userId 열이 없어
 *      제3자가 남의 이메일로 넣은 퍼블릭 문의도 그 사람 화면에 보인다(라우트 주석에 적어 둔 한계).
 *      userId 열이 생기면 ⑤를 그 축으로 옮긴다.
 *   5. 런타임. 이 파일은 소스만 읽는다 — 실제로 목록이 그려지는지는 브라우저 실측이 판정한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));

const PAGE = "app/dashboard/support-center/page.tsx";
const ROUTE = "app/api/support/inquiry/route.ts";

describe("§support-center-fabricated-tickets · 화면은 저장된 것만 보여준다", () => {
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

  it("② 목록·상세는 서버 데이터로만 그린다 (저장 열 없는 표시 부활 0)", () => {
    const page = code(PAGE);
    // 출처는 조회 API 하나.
    // 🛑 경계 필수 — 경계 없이 쓰면 전량 개명(useSupportInquiriesX)에도 GREEN 이다(4원칙 ① · P3 실측).
    expect(page).toMatch(/function useSupportInquiries\(\)/);
    expect(page).toMatch(/\buseSupportInquiries\(\)/);
    expect(page).toMatch(/fetch\("\/api\/support\/inquiry"\)/);
    expect(page).toMatch(/queryKey: \["support-inquiries"\]/);
    // 목록·상세가 그 데이터를 실제로 소비한다
    expect(page).toMatch(/\binquiryList\.map\(/);
    expect(page).toMatch(/\bselectedInquiry\b/);
    expect(page).toMatch(/splitInquiryMessage\(selectedInquiry\.message\)/);
    // 저장하는 열이 없는 표시는 되살리지 않는다 (구 P4 §4 중 복원 불가분)
    expect(page).not.toMatch(/\bslaHours\b/);
    expect(page).not.toMatch(/\banswerBody\b/);
  });

  it("③ 딥링크 실 소비 · 실재하는 접수번호일 때만 연다 (dead param 0)", () => {
    const page = code(PAGE);
    expect(page).toMatch(/params\.set\("inquiryRef"/);
    expect(page).toMatch(/get\("inquiryRef"\)/);
    // 존재 확인 없이 열지 않는다 — 없는 번호로 빈 상세가 뜨면 그것도 지어낸 화면이다
    expect(page).toMatch(/inquiryList\.some\(\(t\) => t\.referenceId === inquiryRefParam\)/);
    // ⌘K 그룹도 같은 출처를 쓴다(리터럴 배열 복귀 금지)
    expect(page).toMatch(/cmdkResults\.inquiry\b/);
  });

  it("④ 0건 · 실패 · 로딩을 뭉개지 않는다 + 접수 배선 보존", () => {
    const page = code(PAGE);
    // 세 분기가 각각 존재한다 — "없음" 과 "못 불러옴" 은 다른 사건이다
    expect(page).toMatch(/\binquiriesLoading\b/);
    expect(page).toMatch(/\binquiriesError\b/);
    expect(page).toMatch(/데이터 없음/);
    expect(page).toMatch(/아직 접수한 문의가 없습니다/);
    expect(page).toMatch(/접수 내역을 불러오지 못했습니다/);
    // 접수 자체는 실제로 저장된다 — 이 배선을 끊으면 "접수됐다" 가 거짓이 된다
    expect(page).toMatch(/csrfFetch\("\/api\/support\/inquiry"/);
    expect(page).toMatch(/data\.referenceId/);
    // 접수 후 목록을 다시 읽는다(내가 방금 넣은 건이 안 보이면 그것도 거짓이다).
    // 🛑 창을 제출 블록으로 좁힌다 — 파일 전체에 걸면 실패 배너의 「다시 시도」 버튼이 **대신 매칭**해
    //    제출 후 재조회를 지워도 GREEN 이었다(4원칙 ④ · P9 실측).
    const from = page.indexOf("const handleSubmit = async");
    const to = page.indexOf("\n  };", from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(page.slice(from, to)).toMatch(/refetchInquiries\(\)/);
  });

  it("⑤ 조회 API — 세션 요구 · 본인 스코프 · 수집 전용 열 비노출", () => {
    const route = code(ROUTE);
    expect(route).toMatch(/export async function GET/);
    expect(route).toMatch(/await auth\(\)/);
    expect(route).toMatch(/status: 401/);
    // 스코프는 세션 이메일 하나 — where 에 그 값이 들어간다
    expect(route).toMatch(/session\?\.user\?\.email/);
    expect(route).toMatch(/where: \{ email \}/);
    // 스팸 방지용 수집 열은 내려주지 않는다
    const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    expect(getBlock).not.toMatch(/ipAddress/);
    expect(getBlock).not.toMatch(/userAgent/);
  });
});
