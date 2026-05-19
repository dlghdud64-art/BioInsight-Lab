/**
 * §11.264j #quote-vendor-response-status — 견적 상세 시트 공급사별 회신 현황 (호영님 spec #2 P1)
 *
 * 호영님 spec:
 *   현재 견적 상세 시트는 카드 표면 정보 (badge / title / headerSummary) 만 반복.
 *   "새 회신 보기" 의 의미가 죽음. 실제 유용한 정보 노출 필요.
 *
 *   기대 표시:
 *     공급사별 회신 현황:
 *       ● A공급사  — 회신 완료 (₩380,000)
 *       ○ B공급사  — 미회신 (11일 경과)
 *
 * Root cause: caller (quotes/page.tsx) §11.248e body 에 vendorRequests 매핑 section 부재.
 *   API /api/quotes 는 이미 `vendorRequests` (id/status/vendorName/createdAt/respondedAt)
 *   를 fetch 중 — 데이터 부재가 아닌 type/렌더 부재.
 *
 * Fix (schema 0, composer/API 0):
 *   (1) Quote interface (line 78) 에 vendorRequests 필드 추가.
 *   (2) §11.248e body 에 "공급사별 회신 현황" section 신규.
 *       vendorRequests.map →
 *         status === "RESPONDED" → ● + vendorName + 매칭 totalPrice
 *         status !== "RESPONDED" → ○ + vendorName + (today - createdAt) days
 *
 * canonical truth lock:
 *   - §11.248e header (badge/#ID/title/summary) 보존
 *   - §11.264i briefSheetOpen state 분리 + ✦ 버튼 보존
 *   - §11.264a chips override 보존
 *   - §11.264d objectLabel 동적 결합 보존
 *   - schema 0 / migration 0 / mutation 0 / composer 0 / server 0
 *
 * Out of scope (§11.264j-2 별도 cluster):
 *   - per-vendor 납기 ("5영업일") — QuoteResponse.deliveryDays 컬럼 신규 필요
 *   - 호영님 spec 의 "5영업일" 부분은 omit (placeholder 0 — dead content 방지)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264j #1 — Quote interface vendorRequests 확장", () => {
  it("§11.264j trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264j/);
  });

  it("Quote interface 에 vendorRequests 필드 정의", () => {
    // vendorRequests?: Array<{
    //   id: string;
    //   status: "SENT" | "RESPONDED" | "EXPIRED";
    //   vendorName: string;
    //   vendorEmail?: string | null;
    //   createdAt: string;
    //   respondedAt?: string | null;
    // }>;
    expect(page).toMatch(
      /vendorRequests\?:\s*Array<\{[\s\S]{0,400}id:\s*string;[\s\S]{0,400}status:[\s\S]{0,200}"SENT"[\s\S]{0,100}"RESPONDED"[\s\S]{0,100}"EXPIRED"/,
    );
    expect(page).toMatch(/vendorName:\s*string/);
    expect(page).toMatch(/createdAt:\s*string/);
  });
});

describe("§11.264j #2 — 공급사별 회신 현황 section 렌더", () => {
  it("§11.248e body 안에 '공급사별 회신 현황' label 추가", () => {
    // Section 라벨 — 호영님 spec 정확 일치
    expect(page).toMatch(/공급사별 회신 현황/);
  });

  it("vendorRequests.map 매핑 패턴", () => {
    // selectedQuote.vendorRequests?.map 또는 .map((req) =>
    expect(page).toMatch(
      /selectedQuote\.vendorRequests[\s\S]{0,200}\.map\(/,
    );
  });

  it("회신 완료 상태 (RESPONDED) ● + vendorName + 가격 매칭", () => {
    // status === "RESPONDED" 분기
    expect(page).toMatch(/status === "RESPONDED"/);
    // ● symbol (emerald 톤)
    expect(page).toMatch(/●/);
  });

  it("미회신 상태 (SENT/EXPIRED) ○ + 경과일", () => {
    // ○ symbol (slate 톤)
    expect(page).toMatch(/○/);
    // 경과일 표시 "{N}일 경과" 패턴
    expect(page).toMatch(/일 경과/);
  });

  it("section data-testid 부여 (Chrome MCP / e2e 안정성)", () => {
    expect(page).toMatch(/data-testid="quote-vendor-response-status"/);
  });
});

describe("§11.264j #3 — invariant 보존 (canonical truth)", () => {
  it("§11.248e mobile context sheet 구조 보존 (header)", () => {
    expect(page).toMatch(/selectedSignals\.badge/);
    expect(page).toMatch(/selectedQuote\.id\.slice\(0,\s*8\)\.toUpperCase\(\)/);
    expect(page).toMatch(
      /<h3\s+className="text-sm font-semibold text-slate-900 truncate">\{selectedQuote\.title\}</,
    );
  });

  it("§11.248e min-[1200px]:hidden 보존 (mobile/tablet only)", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden fixed inset-0 z-40/);
  });

  it("§11.264i briefSheetOpen useState 보존", () => {
    expect(page).toMatch(
      /const\s+\[briefSheetOpen,\s+setBriefSheetOpen\]\s*=\s*useState/,
    );
  });

  it("§11.264i ✦ 운영 브리핑 버튼 보존", () => {
    expect(page).toMatch(/aria-label="운영 브리핑 열기"/);
    expect(page).toMatch(/setBriefSheetOpen\(true\)/);
  });

  it("§11.264a chips override (4 entry) 보존", () => {
    expect(page).toMatch(/\{ id: "summary",\s+label: "상태 요약" \}/);
    expect(page).toMatch(/\{ id: "facts",\s+label: "회신 현황" \}/);
    expect(page).toMatch(/\{ id: "risks",\s+label: "리스크" \}/);
    expect(page).toMatch(/\{ id: "next",\s+label: "발주 전환" \}/);
  });

  it("§11.264d objectLabel 동적 결합 보존", () => {
    expect(page).toMatch(
      /objectLabel=\{`선택한 견적\s*·\s*\$\{selectedQuote\.title\}`\}/,
    );
  });

  it("Quote interface 의 기존 필드 (responses) 보존", () => {
    expect(page).toMatch(
      /responses\?:\s*Array<\{[\s\S]{0,200}vendor:\s*\{\s*name:\s*string\s*\}/,
    );
  });

  it("Quote interface 의 기존 필드 (items) 보존", () => {
    expect(page).toMatch(
      /items:\s*Array<\{[\s\S]{0,300}product:\s*\{\s*id:\s*string;\s*name:\s*string\s*\}/,
    );
  });
});
