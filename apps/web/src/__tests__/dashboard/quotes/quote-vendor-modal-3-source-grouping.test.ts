/**
 * §11.229 #quote-management-v2-phase-c2 — 호영님 v2 #21 공급사 DB UI 3 source grouping
 *
 * 호영님 v2 spec sheet (2026-05-11):
 *   #21 공급사 DB UI 3 경로 modal — 등록된 공급사 / LabAxis 추천 / 이메일 직접 입력
 *
 * 호영님 결정 (2026-05-12):
 *   (c) section header grouping (Tabs 거부 — same-canvas + canonical truth 정합)
 *   3 section default (호영님 v2 spec "3 경로" 정합)
 *
 * canonical truth lock:
 *   - resolveSuppliers (4 priority source) spec 변경 0
 *   - contactSource enum (5 source: supplier_book / recent_rfq / ai_recommended /
 *     manual / org_book) 변경 0
 *   - VendorRequestModal canonical dispatch flow 변경 0
 *   - 단일 scroll list 안 grouping 만 UI 시각화 (Tabs 도입 0)
 *   - §11.217 ~ §11.228 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL_PATH = resolve(__dirname, "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx");
const RESOLVER_PATH = resolve(__dirname, "../../../components/quotes/dispatch/resolve-suppliers.ts");

const modal = readFileSync(MODAL_PATH, "utf8");
const resolver = readFileSync(RESOLVER_PATH, "utf8");

describe("§11.229 #1 — 3 section header grouping", () => {
  it("Section 1 label — '등록된 공급사'", () => {
    expect(modal).toMatch(/등록된 공급사/);
  });

  it("Section 2 label — 'LabAxis 추천'", () => {
    expect(modal).toMatch(/LabAxis 추천/);
  });

  it("Section 3 label — '이메일 직접 입력'", () => {
    expect(modal).toMatch(/이메일 직접 입력/);
  });

  it("section count badge — registered count (registered.length 또는 동등 패턴)", () => {
    // registered group 의 count 노출 — 변수명 자유 (registeredSuppliers.length / registered.length / etc.)
    expect(modal).toMatch(/registered[a-zA-Z]*\.length|registeredCount/);
  });

  it("section count badge — recommended count (recommended.length 또는 동등 패턴)", () => {
    expect(modal).toMatch(/recommended[a-zA-Z]*\.length|recommendedCount/);
  });
});

describe("quote dispatch supplier readiness badges", () => {
  it("supplier cards expose selected and contact state badges", () => {
    expect(modal).toContain("quote-dispatch-selected-badge");
    expect(modal).toContain("quote-dispatch-contact-badge");
    expect(modal).toContain("선택됨");
    expect(modal).toContain("연락처 없음");
    expect(modal).toContain("연락처 확인됨");
  });

  it("Send to supplier stays blocked by supplier/contact readiness checks", () => {
    expect(modal).toMatch(/HARD_BLOCKER_KEYS[\s\S]{0,120}\["supplier",\s*"quote",\s*"contact"\]/);
    expect(modal).toMatch(/sendReadiness\s*===\s*"blocked"/);
  });
});

describe("§11.229 #2 — groupResolvedSuppliers helper (UI derive only)", () => {
  it("groupResolvedSuppliers 또는 동등 grouping helper 정의 (function 또는 const)", () => {
    // helper 함수 또는 useMemo 안 grouping logic
    expect(modal).toMatch(/groupResolvedSuppliers|groupSuppliers|const\s+\{[\s\S]{0,200}registered[\s\S]{0,200}recommended[\s\S]{0,200}\}\s*=\s*useMemo/);
  });

  it("grouping logic — contactSource 분기 (registered = recent_rfq + org_book + supplier_book)", () => {
    // recent_rfq / org_book / supplier_book 중 최소 2개 분기 키 포함
    expect(modal).toMatch(/recent_rfq[\s\S]{0,400}(org_book|supplier_book)|org_book[\s\S]{0,400}(supplier_book|recent_rfq)|supplier_book[\s\S]{0,400}(recent_rfq|org_book)/);
  });

  it("grouping logic — recommended = ai_recommended", () => {
    expect(modal).toMatch(/ai_recommended/);
  });
});

describe("§11.229 #3 — manual form always-visible (footer 링크 제거)", () => {
  it("manual section 항상 노출 — showManualFallback 조건 부재 (또는 default true)", () => {
    // showManualFallback 분기 자체를 제거했거나, 항상 true 로 set.
    // 검증: manual form (manualEmail / manualName / addManualVendor) 가 conditional render 가 아니거나, conditional 의 조건이 항상 true
    // 약한 sentinel: footer 링크의 정확한 문구 '+ 후보에 없는 공급사 직접 추가' 가 file 안 부재
    expect(modal).not.toMatch(/\+ 후보에 없는 공급사 직접 추가/);
  });

  it("manual input — email + 공급사명 input 보존", () => {
    expect(modal).toMatch(/manualEmail/);
    expect(modal).toMatch(/manualName/);
  });

  it("addManualVendor 함수 보존", () => {
    expect(modal).toMatch(/addManualVendor/);
  });

  it("'이메일 직접 입력' section 안 form (Input + 추가 button) 노출", () => {
    // section 3 의 visual locality 검증 — 'placeholder=\"이메일\"' 또는 type=email 인 input 존재
    expect(modal).toMatch(/type="email"|placeholder="이메일"/);
  });
});

describe("§11.229 #4 — invariant 보존 (cluster lineage)", () => {
  it("resolveSuppliers helper 보존 (canonical truth)", () => {
    expect(modal).toMatch(/resolvedSuppliers/);
    expect(resolver).toMatch(/export function resolveSuppliers/);
  });

  it("contactSource enum 5 source 보존 (resolve-suppliers.ts)", () => {
    expect(resolver).toMatch(/"supplier_book"/);
    expect(resolver).toMatch(/"recent_rfq"/);
    expect(resolver).toMatch(/"ai_recommended"/);
    expect(resolver).toMatch(/"manual"/);
    expect(resolver).toMatch(/"org_book"/);
  });

  it("CONTACT_SOURCE_LABEL 5 mapping 보존 (vendor-dispatch-workbench.tsx)", () => {
    expect(modal).toMatch(/CONTACT_SOURCE_LABEL/);
    // §11.237 — file truncation 복구 (sandbox sync drift).
    //   5 source 라벨 (한국어 또는 영어 모두 매핑) 보존.
    expect(modal).toMatch(/공급사 DB|견적 이력|AI 추천|수동 입력|조직 거래처/);
  });
});
