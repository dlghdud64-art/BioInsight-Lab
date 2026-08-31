/**
 * §receiving-detail-redesign — 입고 상세 실데이터 전환 + 라이트 재구성 sentinel (2026-08-17)
 *
 * 잠그는 것: 상세가 데모 시드가 아니라 canonical(ReceivingDraft) 을 읽고, 핸드오프 QA 의
 * 소스 판별 가능 항목이 유지된다. 승계 대상: 290-p4c2 · 290-p4c3 · inbound-detail-mobile PAGE 단언.
 *
 * 잠그지 못하는 것: 실브라우저 렌더(다크 요소 0 은 클래스로만 검사한다) · 실 API 응답 · 모달 흐름의 런타임.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const r = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/* 🛑 부정 단언 전용 — 주석 제거본.
 *    원본에 걸면 그 문자열을 **설명한 주석**까지 매칭돼 영구 RED 가 된다.
 *    실측 2건(2026-08-17): page.tsx L6 헤더 주석이 `useOpsStore` 를,
 *    receiving-batch-modal.tsx L16 주석이 `COA 인식` 을 담고 있었다.
 *    CLAUDE.md §부정 단언 — not.toMatch 는 반드시 *_CODE(주석 제거본)에 건다. */
const strip = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ 	]*\/\/.*$/gm, "");
const rc = (rel: string) => strip(r(rel));

const PAGE = "app/dashboard/receiving/[receivingId]/page.tsx";
const MODAL = "components/receiving/receiving-batch-modal.tsx";
const ROUTE = "app/api/receiving-drafts/[id]/route.ts";
const PANEL = "components/receiving/receiving-review-panel.tsx";
const DOCS = "app/api/receiving/documents/[id]/route.ts";

describe("§receiving-detail P1 — 실데이터 전환", () => {
  it("상세 GET 라우트 실재 · 조회 전용 · 스코프 검사", () => {
    expect(existsSync(join(ROOT, ROUTE))).toBe(true);
    const s = r(ROUTE);
    expect(s).toMatch(/export async function GET/);
    expect(s).not.toMatch(/export async function (POST|PATCH|PUT|DELETE)/);
    expect(s).toMatch(/receivingDraft\.findUnique/);
    expect(s).toMatch(/organizationMember\.findFirst/);
    expect(s).toMatch(/status: 403/);
  });

  it("🛑 상세 페이지 useOpsStore(데모 시드) 0 · canonical GET 호출", () => {
    // 🛑 주석 제거본에 건다 — 헤더 주석이 "데모 시드(useOpsStore) 폐기" 를 담고 있다
    expect(rc(PAGE)).not.toMatch(/useOpsStore|ops-console\/seed-data|VENDOR_MAP/);
    const s = r(PAGE);
    expect(s).toMatch(/fetch\(`\/api\/receiving-drafts\/\$\{receivingId\}`/);
  });

  it("리뷰 패널 → 상세 진입 링크 실재 (목록이 데모 store 인 동안 유일한 경로)", () => {
    expect(r(PANEL)).toMatch(/href=\{`\/dashboard\/receiving\/\$\{d\.id\}`\}/);
  });
});

describe("§receiving-detail P2 — 라이트 재구성 (핸드오프 QA 소스 축)", () => {
  it("QA1 다크 배경 클래스 0", () => {
    const s = r(PAGE);
    expect(s).not.toMatch(/bg-slate-9|bg-slate-8|bg-\[#0[0-9a-f]{5}\]|from-slate-9/);
  });
  it("QA2 플레인 타이틀 22px/800 · 박스 헤더 0", () => {
    const s = r(PAGE);
    expect(s).toMatch(/text-\[22px\] font-extrabold/);
    expect(s).not.toMatch(/OperationalDetailShell|OperationalHeader/);
  });
  it("QA3 검수·문서 상태는 다음 조치 1곳 — 브리핑 바·차단 리스트 0", () => {
    const s = r(PAGE);
    expect(s).toMatch(/aria-label="다음 조치"/);
    expect(s).not.toMatch(/BlockerReviewStrip|PostingReadinessStrip|운영 브리핑/);
    // 다음 조치 패널이 모바일/데스크톱 두 슬롯에 같은 노드로 들어간다 (중복 렌더 아님, 배치만 2곳)
    expect((s.match(/\{NextActionPanel\}/g) ?? []).length).toBe(2);
  });
  it("QA8 원버튼 CTA — 부분 반영·disabled 재고 반영 버튼 0", () => {
    const s = r(PAGE);
    expect(s).toMatch(/남은 \$\{derived\.remaining\}건 처리하고 반영/);
    expect(s).not.toMatch(/disabled=\{[^}]*\}\s*[^>]*>\s*재고 반영/);
  });
  it("QA9 모바일: 다음 조치 최상단 + sticky 단일 CTA", () => {
    const s = r(PAGE);
    expect(s).toMatch(/<div className="lg:hidden">\{NextActionPanel\}<\/div>/);
    expect(s).toMatch(/lg:hidden fixed inset-x-0 bottom-0/);
  });
  it("em dash UI 문구 0 (주석 제외)", () => {
    for (const f of [PAGE, MODAL]) {
      const src = r(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(src.includes("—")).toBe(false);
    }
  });
});

describe("§receiving-detail P3 — 일괄 처리 모달 배선(§6)", () => {
  it("스텝 커밋 = canonical API 즉시 (front-only 0)", () => {
    const s = r(MODAL);
    expect(s).toMatch(/\/api\/receiving-drafts\/\$\{draftId\}\/inspect/);
    expect(s).toMatch(/\/api\/receiving\/documents\/\$\{orderId\}/);
    expect(s).toMatch(/\/api\/receiving-drafts\/\$\{draftId\}\/approve/);
  });
  it("`다음` 차단 사유는 버튼 라벨 인라인 · title 툴팁 0", () => {
    const s = r(MODAL);
    expect(s).toMatch(/`다음 · \$\{blockReason\}`/);
    expect(s).not.toMatch(/\btitle=/);
  });
  it("외부 대기 스텝이 남으면 반영 보류 (approve 미호출)", () => {
    const s = r(MODAL);
    expect(s).toMatch(/if \(externalPending\) \{[\s\S]*?onClose\(\);\s*return;/);
  });
  it("COA 자동 확정 0 — 배지 truth = canonical lotSource (§scan-recognition-upgrade P1 승계)", () => {
    const s = r(MODAL);
    // 승계(2026-08-31 호영님 승인): 구 계약 `COA 인식 출현 0` → 인식 도입 후에는
    // "배지 = canonical lotSource 조건에서만" 으로 진화. UI state 로 배지를 들면 RED.
    // (인식 응답 핸들러의 PATCH 0 프로브는 receiving-coa-recognize.test.ts (c)가 잠근다.)
    expect(rc(MODAL)).toMatch(/lotSource === "coa_ocr"[\s\S]{0,400}?COA 인식/);
    expect(s).toMatch(/확인하고 확정/);
  });
  it("문서 API 가 docType coa 를 받는다", () => {
    expect(r(DOCS)).toMatch(/new Set\(\["invoice", "coa", "photo", "etc"\]\)/);
  });
});
