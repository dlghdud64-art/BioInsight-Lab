/**
 * §support-center P1 (호영님 2026-07-05) — 통합 검색 바 승격 + ⌘K 명령 팔레트.
 * §0 헤더 아래 통합 검색("무엇을 도와드릴까요?") · §1 ⌘K/Ctrl+K 오버레이(매뉴얼·문제해결·접수 내역 3그룹
 * 실시간 필터, Esc·배경 닫힘, reduced-motion). 🔁 2026-09-20: 티켓 그룹이 지어낸 상수에서 실제 접수(ContactInquiry)로 교체됐다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const PAGE = readFileSync(join(__dirname, "..", "..", "app/dashboard/support-center/page.tsx"), "utf8");

describe("§support-center P1 — 통합검색 + ⌘K 팔레트", () => {
  it("§0 통합 검색 바 승격", () => {
    expect(PAGE).toMatch(/무엇을 도와드릴까요/);
  });
  it("§1 ⌘K/Ctrl+K 오버레이 + 결과 3그룹 + reduced-motion", () => {
    expect(PAGE).toMatch(/e\.metaKey \|\| e\.ctrlKey/);
    expect(PAGE).toMatch(/cmdkResults/);
    expect(PAGE).toMatch(/motion-reduce:/);
  });
  /* 🔁 은퇴 → **실데이터 복원** (2026-09-20 · 같은 날 두 번 움직였다)
   *   구 계약: ticketId 딥링크가 실 소비된다 — 소비처가 지어낸 티켓 2건이었다(제거 c3f046fb).
   *   복원  : 조회 API 신설로 소비처가 실제 접수(ContactInquiry)가 됐다. 파라미터 이름만
   *            ticketId → inquiryRef(접수번호) 로 바뀌었고 **명제는 그대로**다.
   *            겹 단언: support-center-fabricated-tickets ③. */
  it("§1 inquiryRef 딥링크 = 실 소비(dead param 아님) · 3그룹 유지", () => {
    expect(PAGE).toMatch(/params\.set\("inquiryRef"/);
    expect(PAGE).toMatch(/searchParams\??\.get\("inquiryRef"\)/);
    // 소비처가 서버 목록이다 — 리터럴 배열로 되돌아가면 RED
    expect(PAGE).toMatch(/inquiryList\.some\(\(t\) => t\.referenceId === inquiryRefParam\)/);
    // 🛑 여기서 `not.toMatch(/MOCK_TICKETS/)` 를 쓰지 않는다 — 이 파일은 주석을 포함한 원문을 읽으므로
    //    "지어낸 티켓을 지웠다" 고 **설명하는 주석**에 걸린다(구현자가 주석을 지워 통과하는 자기 함정).
    //    리터럴 부활 금지는 stripComments 본문에 거는 support-center-fabricated-tickets ① 이 문다.
    // 팔레트 3그룹 유지(매뉴얼·문제해결·접수 내역)
    expect(PAGE).toMatch(/cmdkResults\.inquiry\b/);
  });
  it("회귀 0 — handleTabChange 보존 + orphan globalSearch 0", () => {
    expect(PAGE).toMatch(/const handleTabChange/);
    expect(PAGE).not.toMatch(/globalSearch/);
  });
});
