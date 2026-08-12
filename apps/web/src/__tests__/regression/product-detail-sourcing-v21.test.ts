/**
 * §product-detail-sourcing-v21 — 소싱 제품 상세 (모바일·웹) 구현 지시문 v2.1
 *
 * 핸드오프: 소싱 제품 상세 핸드오프 v2.1.md (2026-08-09)
 * 시각 truth: 소싱 제품 상세 개선 시안 v4.1.html — 섹션 2 (2a 모바일 카드 · 2b 안전·규제 · 2c 대체품 · 2d 웹 상세)
 *
 * ⛔ 결정 교체 게이트 (호영님 승인 2026-08-09 "진행" · 시안 우선 "시안대로해"):
 *   B1 — PD-E "시안대로 내부 등급·출처 노출"(2026-06-20) **철회**. 내부 용어 메타는 buyer 화면에서 삭제.
 *   B2 — 계약④ 담김 주 CTA `견적 요청서 만들기` → `담김 ✓ · 견적함 보기`. 목적지(/dashboard/quotes)는 승계.
 *   B3 — 계약④ 보조 2분할(비교 검토 · 재고 조회) 폐기. 레일 1행 압축.
 *   B4 — PD-A 상시 신뢰 문구 폐기 → 첫 담기 1회 toast 안내로 이전(문구 자체는 소멸하지 않는다).
 *        🔁 이전처 변경 (§sourcing-quote-flow v1.1 ⑥, 2026-08-12): toast → **담김 캡션**.
 *           B4 의 본체는 "문구의 존속" 이지 그릇이 아니다. toast 는 3중 피드백이라 제거.
 *
 * 은퇴→승계 분류표: sentinel-분류표-product-detail-v2.1.md
 *   구 계약 파일(product-detail-refinement / -completeness-pd-b / -hero-keyfacts-pd-e /
 *   -alt-card-pd-g / -msds-pd-c)은 삭제하지 않고 해당 it 만 승계 문구로 교체했다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const PAGE = root("app/products/[id]/page.tsx");
const PENDING = root("components/products/pending-info-row.tsx");
const PAGE_CODE = stripComments(PAGE);
const PENDING_CODE = stripComments(PENDING);

/* ─────────────────────────────────────────────────────────────
 * §1 — 권한 규칙
 *   buyer 화면 dead link 6개(스펙 편집 ×3 · 안전 정보 편집 · SDS 업로드 ×2 · 정보 요청) 제거.
 *   canEditSpec = ADMIN·SUPPLIER 만 편집 UI 생성. disabled 아님 = **미생성**.
 *
 * ⚠️ 표면 범위 정정 (2026-08-09) — 원 문구는 "전 표면 공통" 이었으나 **작성 시 실제로 본
 *   것은 제품 상세(`products/[id]`) 하나뿐**이었다. §sds-upload-role-gate 착수 중
 *   `dashboard/safety` 가 같은 행위(MSDS 업로드)를 **role 게이트 없이** 노출하고 있음이
 *   드러나, 서버만 막았다면 그 표면에서 front-only 실패를 새로 만들 뻔했다.
 *   → §1 이 실제로 지배하는 표면은 최소 **둘**이다:
 *       ① `app/products/[id]/page.tsx`        — canEditSpec 게이트 (이 파일이 잠금)
 *       ② `app/dashboard/safety/page.tsx`     — canUploadMsds 게이트 (동일 조건, 8b363bb3)
 *   신규 표면에 편집·업로드 진입을 추가할 때는 §1 적용 대상인지 먼저 판정할 것.
 *   "전 표면 공통" 같은 범위 주장은 실제로 전수 확인한 뒤에만 쓴다 — 확인 없이 쓰면
 *   다음 표면에서 같은 충돌이 재발한다.
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §1 — buyer 권한 밖 UI 미생성", () => {
  it("canEditSpec 단일 파생(role → 권한)", () => {
    expect(PAGE).toMatch(/const canEditSpec = role === "ADMIN" \|\| role === "SUPPLIER"/);
  });
  it("편집·업로드 진입이 모두 canEditSpec 게이트 안", () => {
    expect(PAGE).toMatch(/canEditSpec[\s\S]{0,600}?스펙 편집/);
    expect(PAGE).toMatch(/canEditSpec[\s\S]{0,400}?안전 정보 편집/);
    expect(PAGE).toMatch(/canEditSpec[\s\S]{0,400}?SDS 업로드/);
  });
  it("안전 정보 편집이 isAdmin 게이트로 회귀하지 않음(SUPPLIER 배제 금지)", () => {
    expect(PAGE_CODE).not.toMatch(/isAdmin && \([\s\S]{0,300}?안전 정보 편집/);
  });
  it("buyer 정보 요청 링크 0 — /support 수렴 경로 폐기", () => {
    expect(PAGE_CODE).not.toMatch(/label: "정보 요청", href: "\/support"/);
    expect(PAGE_CODE).not.toMatch(/action=\{\{ label: "정보 요청"/);
  });
  /* 보증 범위 이력 (2026-08-09):
   *   ① 최초 문구 "개인 업로드 경로 차단" → 서버에 role 게이트가 없어 **거짓 보증**이었다.
   *   ② 실측 후 "UI 가드"로 축소(정직 표기).
   *   ③ §sds-upload-role-gate 완료 → 서버가 docType=sds 를 합집합(global ADMIN·SUPPLIER·
   *      조직 ADMIN/VIEWER)으로 막는다. 이제 UI 가드 + 서버 강제 **양쪽**이 보증한다.
   *   서버 분기의 행위 검증은 __tests__/api/products-id-sds/upload-role-gate.test.ts 가 담당
   *   (coa 는 소유권이 게이트라 role 무관 — 여기서 role 게이트를 걸면 회귀). */
  it("SDS 업로드 UI 가드 — canEditSpec 안에서만 마운트 (서버 강제 §sds-upload-role-gate 와 짝)", () => {
    expect(PAGE).toMatch(/canEditSpec \?[\s\S]{0,200}?<SdsDocumentsSection/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * §1 — 완성도 게이지 은퇴 → 미등록 접힌 1줄
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §1 — 완성도 게이지 은퇴 / PendingInfoRow 승계", () => {
  it("PAGE 에서 완성도 게이지 진입점 소멸", () => {
    expect(PAGE_CODE).not.toMatch(/<ProductCompleteness/);
    expect(PAGE_CODE).not.toMatch(/제품 정보 완성도/);
  });
  it("PendingInfoRow 가 승계(1줄 문구 고정)", () => {
    expect(PAGE).toMatch(/<PendingInfoRow[\s\S]{0,200}?product=\{product\}/);
    expect(PENDING).toMatch(/일부 정보 미등록 · 견적·문의 시 안내됩니다/);
  });
  it("접힌 1줄은 탭 시 미등록 목록 노출(정보 은폐 0)", () => {
    expect(PENDING).toMatch(/missingLabels/);
    expect(PENDING).toMatch(/aria-expanded=\{open\}/);
  });
  it("액션 0 — 요청/편집 링크를 만들지 않는다", () => {
    expect(PENDING_CODE).not.toMatch(/정보 요청|SDS 요청|스펙 편집|href="\/support"/);
  });
  it("미등록 0건이면 렌더 자체 없음(빈 줄·대시 금지)", () => {
    expect(PENDING).toMatch(/if \(missingLabels\.length === 0\) return null/);
  });
  it("완성도 산정 계층은 무손상(공급사 콘솔용 존치)", () => {
    expect(PENDING).toMatch(/computeCompleteness/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * §2 — 제품 카드 / 내부 용어 메타 제거
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §2 — 내부 용어 메타 0 · 중복 카드 폐기", () => {
  it("히어로 키 팩트 행(출처·내부 등급·안전 위험도) 폐기", () => {
    expect(PAGE_CODE).not.toMatch(/label: "출처"/);
    expect(PAGE_CODE).not.toMatch(/label: "내부 등급"/);
    expect(PAGE_CODE).not.toMatch(/label: "안전 위험도"/);
  });
  it('"제품 사양" 통합 카드(PD-J) 폐기 — 헤더 메타 중복 제거', () => {
    expect(PAGE_CODE).not.toMatch(/Cat\.No \(카탈로그 번호\)/);
    expect(PAGE_CODE).not.toMatch(/getDisplaySpecs\(/);
  });
  it("분류 칩 + Cat.No mono 는 히어로에 보존(정보 손실 0)", () => {
    expect(PAGE).toMatch(/PRODUCT_CATEGORIES\[product\.category/);
    expect(PAGE).toMatch(/font-mono font-semibold text-slate-900">\{product\.catalogNumber\}/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * §5 — 안전·규제 정보
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §5 — 안전·규제 헤더/포털/각주", () => {
  it("헤더 1행 고정 — 제목 nowrap + 위험도 pill nowrap·shrink-0", () => {
    expect(PAGE).toMatch(/whitespace-nowrap">안전·규제 정보<\/h3>/);
    expect(PAGE).toMatch(/shrink-0 whitespace-nowrap[\s\S]{0,300}?위험도 \{safetyLevel\.label\}/);
  });
  it("섹션 아이콘 = 라인 15px 슬레이트(§8, 색 채움 금지)", () => {
    expect(PAGE).toMatch(/<Shield className="h-\[15px\] w-\[15px\] shrink-0 text-slate-500"/);
  });
  it("SDS 정직 표기 1종", () => {
    expect(PAGE).toMatch(/등록 없음 · 공급사\/관리자 등록 시 표시됩니다/);
  });
  it("포털 = 주요 2기관 버튼 + 더보기 N개 기관(세로 6나열 회귀 0)", () => {
    expect(PAGE).toMatch(/REG_PORTAL_ALWAYS/);
    expect(PAGE).toMatch(/더보기 \$\{rest\.length\}개 기관/);
    expect(PAGE_CODE).not.toMatch(/CollapsedRow label="국내 규제기관 포털"/);
  });
  it("경고문 = 회색 각주 1줄(yellow 과경고 박스 폐기)", () => {
    expect(PAGE).toMatch(/참고용 정보입니다\. 취급\/보관\/폐기 지침은 SDS\/MSDS 원문을 우선 확인하세요\./);
    expect(PAGE_CODE).not.toMatch(/<Disclaimer type="safety"/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * §6 — 대체품 추천
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §6 — 대체품 근거 필수 · 비교 버튼 0", () => {
  it("매칭 근거 파생 단일 출처(matchReasons) + grade 누출 필터 승계", () => {
    expect(PAGE).toMatch(/function matchReasons\(alt: any\): string\[\]/);
    expect(PAGE).toMatch(/filter\(\(r: string\) => !\/grade\/i\.test\(r\)\)/);
  });
  it("근거 0건 품목은 추천 미노출", () => {
    expect(PAGE).toMatch(/matchReasons\(alt\)\.length > 0/);
    expect(PAGE).toMatch(/if \(shown\.length === 0\) return null/);
  });
  it("근거 칩은 1개만(중복 나열 폐기)", () => {
    expect(PAGE).toMatch(/\{matchReasons\(alt\)\[0\]\}/);
    expect(PAGE_CODE).not.toMatch(/\.slice\(0, 3\)[\s\S]{0,200}?similarityReasons/);
  });
  it("비교 버튼 0 — 상세 링크 단독(dead button 금지)", () => {
    expect(PAGE_CODE).not.toMatch(/\{isInCompare \? "비교 제거" : "비교"\}/);
    expect(PAGE).toMatch(/상세 <ChevronRight/);
  });
  it("건수는 제목 옆 인라인", () => {
    expect(PAGE).toMatch(/유사 스펙 \{shown\.length\}건/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * §7 — 견적 바 / 레일
 * ───────────────────────────────────────────────────────────── */
describe("§v21 §7 — 담김 상태 전환 · 1행 압축", () => {
  it("담기 후 버튼 상태 전환(데스크탑·모바일 2곳)", () => {
    expect(PAGE.match(/담김 ✓ · 견적함 보기/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it("담김 CTA 목적지는 /dashboard/quotes 승계(계약④ 무손상)", () => {
    expect(PAGE).toMatch(/href="\/dashboard\/quotes">[\s\S]{0,200}?담김 ✓ · 견적함 보기/);
  });
  it("상시 문구 0 — 구매 의무·납기는 화면에서 제거", () => {
    expect(PAGE_CODE).not.toMatch(/<p[^>]*>견적 요청은 무료이며 구매 의무가 없습니다\./);
    expect(PAGE_CODE).not.toMatch(/<Calendar className="w-3 h-3" \/> 납기/);
  });
  /**
   * 🔁 승계 (§sourcing-quote-flow v1.1 ⑥, 호영님 2026-08-12) — **이전처만 바뀌었다.**
   *   B4 가 지키려던 것은 "문구의 존속" 이지 "toast 라는 그릇" 이 아니다.
   *   toast(그릇) 제거 → 3중 피드백 해소(문서 §0-1) / 문구는 **담김 캡션**으로 이동.
   *   담김 상태에서만 노출되므로 PD-A 상시 문구 폐기 결정도 함께 유지된다.
   *   "구매 의무가 없습니다" 는 길이 때문에 뺐다 — 견적 요청 화면에서 다시 말한다.
   *
   *   ⚠️ 이 it 의 계약: **문구가 어디에도 없으면 RED.** 그것이 B4 의 본체다.
   */
  it("신뢰 문구는 소멸이 아니라 담김 캡션으로 이전(정보 손실 0)", () => {
    expect(PAGE_CODE).toMatch(/발송 준비를 시작합니다 · 견적 요청은 무료입니다/);
    // toast 라는 그릇은 사라졌다(3중 피드백 해소)
    expect(PAGE_CODE).not.toMatch(/title: "견적함에 담았습니다"/);
  });
  it("담김 캡션 = 담김 상태에서만(상시 아님) · 데스크탑·모바일 2곳", () => {
    expect(PAGE_CODE.match(/담긴 \{quoteCartCount\}건으로 발송 준비를 시작합니다/g)?.length ?? 0)
      .toBeGreaterThanOrEqual(2);
    // 카운트 단일 출처 — 별도 소스 금지
    expect(PAGE_CODE).toMatch(/setQuoteCartCount\(cart\.length\)/);
  });
  it("레일 보조 버튼·링크 0(비교 검토·재고 조회)", () => {
    expect(PAGE_CODE).not.toMatch(/비교 검토/);
    expect(PAGE_CODE).not.toMatch(/재고 조회/);
  });
  /* "영업 문의" /support 링크 — 양성 잠금 (2026-08-09 실측 정정).
   *   1차 개정이 "전역 내비가 /support 를 보유"한다는 근거로 이 링크를 지웠으나 반증됐다:
   *   /products/[id] 는 자체 layout 이 없고 root layout·page 모두 MainHeader 를 렌더하지
   *   않아 이 링크가 이 표면의 **유일한 /support 진입**이다(§detail-contrast-slate100 이
   *   다크 맞춤견적 카드의 후신=대체 경로로 지정한 승계 계약).
   *   부정 단언으로 지우는 실수가 반복되지 않도록 존재를 여기서 양성으로 잠근다. */
  it("영업 문의 /support 링크 존치 — 이 표면의 유일한 지원 진입", () => {
    expect(PAGE).toMatch(/<Link href="\/support"[^>]*>영업 문의<\/Link>/);
  });
  it("견적 담기 CTA 보존(회귀 0)", () => {
    expect(PAGE).toMatch(/견적 담기/);
    expect(PAGE).toMatch(/견적가 안내 품목/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * 회귀 0 — canonical truth 무접촉
 * ───────────────────────────────────────────────────────────── */
describe("§v21 — 회귀 0(canonical truth 무접촉)", () => {
  it("견적함 저장 계층 단일 출처 유지", () => {
    expect(PAGE).toMatch(/addToQuoteCart|readQuoteCart|removeFromQuoteCart/);
    expect(PAGE).toMatch(/quote-cart-changed/);
  });
  it("담김 해제가 실 mutation(front-only success 0)", () => {
    expect(PAGE).toMatch(/removeFromQuoteCart\(product\.id\)/);
  });
  it("규제 링크 소스 보존", () => {
    expect(PAGE).toMatch(/getRegulationLinksForProduct\(/);
  });
  it("SDS 문서 섹션(서명URL) 보존", () => {
    expect(PAGE).toMatch(/<SdsDocumentsSection productId=\{product\.id\} docType="sds"/);
  });
  it("PD-K 히어로 썸네일 보존", () => {
    expect(PAGE).toMatch(/w-20 h-20 md:w-24 md:h-24/);
  });
});
