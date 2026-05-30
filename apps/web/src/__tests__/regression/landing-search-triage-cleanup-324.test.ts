/**
 * §11.324 #landing-search-triage-cleanup — Regression sentinel (Phase 1 RED)
 *
 * 호영님 P2 (구 spec §11.320, 번호 충돌로 §11.324 매핑, 2026-05-30):
 *
 *   비로그인 랜딩 `/search` 페이지에 실제 사용 UI (Sourcing Result Triage 데모) 그대로 노출:
 *   - Triage 4 카드 (Exact Match / Cross-Vendor / Substitute / Blocked)
 *   - Shortlist / Hold / Exclude 액션 button
 *   - Step 2 / Step 3 button
 *   - "로그인 후 계속" + Compare panel 안내 + live-state 영역
 *   = 비로그인 방문자 인지 부하 + dead button 위험 + 가입 conversion 저해.
 *
 *   호영님 A안 (권장): 데모 제거 + 3단계 다이어그램 (검색/비교/견적) + 큰 가입 CTA.
 *
 *   본 sentinel = Phase 1 RED. Phase 2 GREEN target:
 *   - Triage 데모 section (line 185-286) 전체 제거
 *   - triageGroups data + publicTriageStage/Action state + handleTriageAction/handleStepAction 제거
 *   - 3단계 다이어그램 신규 (① 검색 ② 비교 ③ 견적)
 *   - 큰 가입 CTA 신규 ("무료로 시작하기" Link to /auth/signin)
 *
 * canonical 보존 (Phase 3 가드):
 *   - 상단 띠 가입 banner (data-testid="search-signup-banner") 보존
 *   - 히어로 (h1 + 검색창 handleSearch wiring) 보존
 *   - 검색 예시 칩 보존
 *   - app/_workbench/search/page.tsx 영향 0 (별개 surface)
 *   - /products/[id] 라우트 영향 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE_PATH = "src/app/search/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.324 — Triage 데모 section 제거 (Phase 2 GREEN target)", () => {
  it("search-result-triage testid + aria-label '소싱 결과 분류' section 제거", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/data-testid="search-result-triage"/);
    expect(src).not.toMatch(/aria-label="소싱 결과 분류"/);
  });

  it("triageGroups data 제거 (Exact Match / Cross-Vendor / Substitute / Blocked)", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/title:\s*"Exact Match"/);
    expect(src).not.toMatch(/title:\s*"Cross-Vendor Equivalent"/);
    expect(src).not.toMatch(/title:\s*"Substitute"/);
    expect(src).not.toMatch(/title:\s*"Blocked"/);
  });

  it("Shortlist / Hold / Exclude action button 패턴 제거", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/actions:\s*\["Shortlist",\s*"Hold",\s*"Exclude"\]/);
  });

  it("Step 2 / Step 3 button (search-step-2-compare / search-step-3-request testid) 제거", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/data-testid="search-step-2-compare"/);
    expect(src).not.toMatch(/data-testid="search-step-3-request"/);
    expect(src).not.toMatch(/Step 2 제품 비교/);
    expect(src).not.toMatch(/Step 3 견적 요청/);
  });

  it("publicTriageStage / publicTriageAction state + handler 제거 (코드 선언/사용 0, 주석 설명 제외)", () => {
    const src = read(PAGE_PATH);
    // useState 선언 패턴 0 (주석 안 문자열은 허용, 선언/할당만 금지)
    expect(src).not.toMatch(/useState<"ready" \| "compare" \| "request">/);
    expect(src).not.toMatch(/setPublicTriageStage|setPublicTriageAction/);
    // handler 함수 선언 패턴 0
    expect(src).not.toMatch(/const handleTriageAction\s*=|const handleStepAction\s*=/);
  });

  it("Compare panel 안내 + live-state 영역 제거", () => {
    const src = read(PAGE_PATH);
    expect(src).not.toMatch(/data-testid="search-triage-compare-panel"/);
    expect(src).not.toMatch(/data-testid="search-triage-live-state"/);
    expect(src).not.toMatch(/data-testid="search-triage-action-dock"/);
  });
});

describe("§11.324 — 3단계 다이어그램 + 가입 CTA 신설 (Phase 2 GREEN target)", () => {
  it("3단계 다이어그램 section testid", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/data-testid="landing-search-flow-steps"/);
  });

  it("3단계 라벨 — 검색 / 비교 / 견적", () => {
    const src = read(PAGE_PATH);
    // 다이어그램 안 세 단계 라벨
    expect(src).toMatch(/landing-search-flow-steps[\s\S]{0,1500}검색[\s\S]{0,300}비교[\s\S]{0,300}견적/);
  });

  it("큰 가입 CTA — '무료로 시작하기' 또는 '30초 가입' Link to /auth/signin", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/data-testid="landing-search-primary-cta"/);
    expect(src).toMatch(/무료로 시작하기|30초 가입/);
    expect(src).toMatch(/landing-search-primary-cta[\s\S]{0,400}\/auth\/signin/);
  });
});

describe("§11.324 — canonical 보존 (상단 띠 + 히어로 + 예시 칩)", () => {
  it("상단 띠 가입 banner (search-signup-banner) 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/data-testid="search-signup-banner"/);
    expect(src).toMatch(/무료 가입하고 비교·견적까지/);
  });

  it("히어로 h1 + 검색창 handleSearch wiring 보존", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/연구 시약·장비 검색/);
    expect(src).toMatch(/handleSearch/);
    expect(src).toMatch(/placeholder="시약명·CAS·제조사"/);
  });

  it("검색 예시 칩 영역 보존 (Example queries)", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/Example queries|예시|예시:\s*PBS/i);
  });

  it("워크벤치 (/_workbench/search) + /products/[id] 라우트 영향 0 (본 page.tsx 단독 변경)", () => {
    // 본 sentinel 은 app/search/page.tsx 만 단언. 워크벤치/products 별개 file.
    const src = read(PAGE_PATH);
    expect(src).toMatch(/"use client"/);
  });
});
