/**
 * §11.229b-3 #mobile-vendor-request-recall — 호영님 §11.229b-2 자연 후속.
 *
 * 호영님 spec: "Minimum vendorResponses recall" — quote.vendorRequests 의 이전 발송
 *   공급사 list 를 modal 안 "최근 발송 공급사" section 으로 표시 + checkbox 다중
 *   선택 + 수동 입력 병행. server GET /api/quotes/[id] 안 vendorRequests include
 *   확장 필요 (현재 0).
 *
 * Strategy:
 *   - server route GET /api/quotes/[id] 안 include.vendorRequests + select
 *     vendorEmail/vendorName 추가. dedup (email 기준) — 동일 vendor 중복 제거.
 *   - mobile QuoteDetail type 안 vendorRequests?: Array<{vendorEmail, vendorName}>.
 *   - modal 안 recall section — FlatList 또는 vertical Pressable list + 체크박스.
 *   - handleSubmit — selected recall set + 수동 입력 vendor merge → vendors array.
 *
 * canonical truth lock:
 *   - §11.229b RN Modal + §11.229b-2 message 모두 보존.
 *   - 서버 POST /api/quotes/[id]/vendor-requests 변경 0 (vendors array shape 동일).
 *   - 서버 §11.229c TLD blacklist + bare IP refine 보존 (multi-vendor 도 자동 적용).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MODAL_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/components/quotes/vendor-request-modal.tsx",
);
const TYPES_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/types/index.ts",
);
const ROUTE_GET_PATH = resolve(
  __dirname,
  "../../app/api/quotes/[id]/route.ts",
);
const ROUTE_POST_PATH = resolve(
  __dirname,
  "../../app/api/quotes/[id]/vendor-requests/route.ts",
);

const modal = safeRead(MODAL_PATH);
const types = safeRead(TYPES_PATH);
const routeGet = safeRead(ROUTE_GET_PATH);
const routePost = safeRead(ROUTE_POST_PATH);

describe("§11.229b-3 #1 — server GET /api/quotes/[id] vendorRequests include", () => {
  it("vendorRequests include 추가 (또는 select vendorEmail/vendorName)", () => {
    expect(routeGet).toMatch(/vendorRequests/);
  });

  it("vendorEmail + vendorName select", () => {
    // QuoteVendorRequest 안 vendorEmail / vendorName field
    expect(routeGet).toMatch(/vendorEmail/);
    expect(routeGet).toMatch(/vendorName/);
  });
});

describe("§11.229b-3 #2 — mobile QuoteDetail.vendorRequests type", () => {
  it("QuoteDetail 또는 Quote interface 안 vendorRequests field", () => {
    expect(types).toMatch(/vendorRequests/);
  });

  it("vendorRequests Array — vendorEmail + vendorName", () => {
    expect(types).toMatch(/vendorRequests\?:\s*Array|vendorRequests\?:\s*\{[\s\S]*?\}\[\]/);
  });
});

describe("§11.229b-3 #3 — modal recall section + multi-select", () => {
  it("selectedRecall state — Set 또는 Array 으로 선택된 vendor 추적", () => {
    expect(modal).toMatch(/(selectedRecall|recallSelected|selectedVendors)/);
  });

  it("recall section header (한국어 — 최근 발송 / 이전 공급사)", () => {
    expect(modal).toMatch(/(최근 발송|이전 공급사|발송 이력)/);
  });

  it("recall list render — vendorRequests prop 또는 quote 안 vendorRequests", () => {
    expect(modal).toMatch(/vendorRequests/);
  });

  it("handleSubmit 안 selected recall + 수동 입력 vendors array merge", () => {
    // mutate body 안 vendors — array literal 또는 변수 사용 양방향 매칭
    expect(modal).toMatch(/mutate[\s\S]{0,800}vendors:\s*(\[|vendorsArray|vendorList)/);
    // selected recall 을 vendors array 에 포함 (push / forEach / map / spread / for..of 패턴)
    expect(modal).toMatch(/(for\s*\(\s*const\s+\w+\s+of\s+selectedRecall|\.\.\.[\w]*recall|selectedRecall[\s\S]{0,200}push|selectedRecall[\s\S]{0,200}forEach|selectedRecall[\s\S]{0,200}map)/);
  });

  it("primary button disabled — 선택 0 + 수동 입력 empty 양쪽 모두 empty 시 disabled", () => {
    expect(modal).toMatch(/disabled=\{!canSubmit\}|disabled=\{[\s\S]{0,200}canSubmit/);
  });
});

describe("§11.229b-3 #4 — invariant 보존", () => {
  it("§11.229b RN Modal animationType fade + transparent 보존", () => {
    expect(modal).toMatch(/animationType=["']fade["']/);
    expect(modal).toMatch(/transparent/);
  });

  it("§11.229b vendor email 수동 입력 TextInput 보존", () => {
    expect(modal).toMatch(/vendorEmail/);
    expect(modal).toMatch(/keyboardType=["']email-address["']/);
  });

  it("§11.229b-2 message TextInput + multiline 보존", () => {
    expect(modal).toMatch(/message/);
    expect(modal).toMatch(/multiline/);
  });

  it("§11.229c 서버 POST CreateVendorRequestsSchema + VendorSchema 보존", () => {
    expect(routePost).toMatch(/CreateVendorRequestsSchema/);
    expect(routePost).toMatch(/VendorSchema/);
    expect(routePost).toMatch(/INVALID_TLDS/);
  });

  it("§11.229b useVendorRequestMutation vendors array 시그니처 보존 (multi-vendor 자동 지원)", () => {
    expect(routePost).toMatch(/vendors:\s*z\.array\(VendorSchema\)\.min\(1/);
  });

  it("§11.229b-3 trace marker comment", () => {
    expect(modal).toMatch(/§11\.229b-3|11\.229b-3/);
  });
});
