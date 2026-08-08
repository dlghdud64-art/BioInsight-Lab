/**
 * §quote-item-vendor-selection Phase 3 — 견적 상세 매트릭스 선택 배선 sentinel.
 *
 * 계약 (계획서 §3·§4):
 *   U1 배선: 셀 CTA → csrfFetch("/api/quotes/{id}/select-item-vendor") POST
 *      (raw fetch 금지 — §support-csrf-fix·§reorder-quote-handoff 403 사고 계보).
 *   U2 응답 있는 셀만 선택 가능 — 무응답 셀("—")은 CTA 미노출 (dead button 금지).
 *   U3 저장 성공 시에만 확정 표시 (placeholder success 금지) — 서버 응답 후
 *      quote 조회 무효화로 truth 재수신. 낙관적 확정 표시 금지.
 *   U4 확정 truth = item.selectedVendorRequestId (DB) — 로컬 state 가 확정을
 *      소유하지 않는다 (canonical truth 보호). 로컬 state 는 pending 표시 전용.
 *   U5 해제 가능 — 확정된 셀 재선택 시 null 저장.
 *   U6 정직 캡션: 최저가는 추천이며 확정은 사용자 선택임을 명시.
 *   U7 실패 시 에러 표기 + 확정 표시 0.
 *
 * 검증: readFileSync+regex 정적 sentinel (repo 관례) → operator 실 vitest 권위.
 * 커버 안 함: 시각 정밀·실제 클릭 흐름 — P5 배포 후 prod 실측 몫
 * (라이브 표면 실행 검증 규율 — 미push 상태라 P5 로 이연).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PAGE = readFileSync(join(ROOT, "app/quotes/[id]/page.tsx"), "utf8");

describe("§quote-item-vendor-selection P3 — 매트릭스 선택 배선", () => {
  it("U1 csrfFetch 로 select-item-vendor POST (raw fetch 금지)", () => {
    expect(PAGE).toMatch(/csrfFetch\(\s*`\/api\/quotes\/\$\{[^}]+\}\/select-item-vendor`/);
    expect(PAGE).not.toMatch(/[^f]fetch\(\s*`\/api\/quotes\/\$\{[^}]+\}\/select-item-vendor`/);
  });

  it("U2 응답 있는 셀만 CTA — 무응답 셀은 선택 불가", () => {
    // 셀 CTA 는 price/ri 존재 분기 안에서만 렌더
    expect(PAGE).toMatch(/data-testid="item-vendor-select-cta"/);
    expect(PAGE).toMatch(/handleSelectItemVendor/);
  });

  it("U3 저장 성공 시에만 확정 — 낙관적 표시 0, 성공 후 quote 무효화", () => {
    // ⚠️ 핸들러 귀속 필수: 전역 invalidateQueries 매칭은 기존 3개 호출로 공허
    //    GREEN 이 된다(RED 캡처 시 발각 — 2026-08-07). 반드시 핸들러 본문 안에서.
    const start = PAGE.indexOf("const handleSelectItemVendor");
    expect(start).toBeGreaterThan(-1);
    const handler = PAGE.slice(start, start + 2200);
    expect(handler).toMatch(/invalidateQueries\(\{\s*queryKey:\s*\["quote",\s*quoteId\]\s*\}\)/);
    // 무효화는 res.ok 확인 이후에만 (실패 시 truth 재수신 없음 = 표시 변화 0)
    const okIdx = handler.indexOf("res.ok");
    const invIdx = handler.indexOf("invalidateQueries");
    expect(okIdx).toBeGreaterThan(-1);
    expect(invIdx).toBeGreaterThan(okIdx);
    // 로컬 확정 state 금지 — pending 전용 state 만 허용
    expect(PAGE).not.toMatch(/setSelectedVendorFor(Item)?\(/);
  });

  it("U4 확정 truth = item.selectedVendorRequestId (DB 값 렌더)", () => {
    expect(PAGE).toMatch(/item\.selectedVendorRequestId === vr\.id/);
  });

  it("U5 해제 — 확정된 셀 재선택 시 null 저장", () => {
    expect(PAGE).toMatch(/isSelected \? null : vr\.id|vendorRequestId:\s*isSelected \? null/);
  });

  it("U6 정직 캡션 — 최저가는 추천, 확정은 선택", () => {
    expect(PAGE).toMatch(/최저가는 추천[^"]*확정|추천일 뿐/);
  });

  it("U7 실패 시 에러 표기 (placeholder success 금지)", () => {
    expect(PAGE).toMatch(/handleSelectItemVendor[\s\S]{0,1800}(toast|setSelectError)/);
    expect(PAGE).toMatch(/res\.ok/);
  });

  it("[회귀] 기존 매트릭스 렌더 보존 — 최저가 강조·합계 행", () => {
    expect(PAGE).toMatch(/최저가/);
    expect(PAGE).toMatch(/총 합계/);
  });
});
