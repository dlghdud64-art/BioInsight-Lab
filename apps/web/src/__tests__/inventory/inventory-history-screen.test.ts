/**
 * §inventory-history-screen — 시약 이력 추적 화면 sentinel.
 *
 * 요구(§inventory-brief-delta 2026-07-29 §3 · HANDOFF §3 P2):
 *   /dashboard/inventory/history?itemId={id} — 품목 프리셀렉트 · 기간 전체 기본 · 전수·출력 담당.
 *   배선 2곳: ① 브리핑 액션 행 `입·출고 기록` 버튼 ② 최근 입출고 하단 `전체 이력 보기 ›` 딥링크.
 *
 * 결정(PLAN_inventory-history-screen.md §0, 호영님 승인 2026-07-31):
 *   - 데이터 = 기존 movements 라우트 확장(from/to 기간 · offset 페이지네이션 · 상한 상향).
 *     신규 전수 엔드포인트 금지(계약 이원화 방지). 브리핑 기본값(5)·정렬·ownership 보존.
 *   - 화면 범위 = 입출고 전수만. 수정 이력(DataAuditLog)은 브리핑 섹션 소관 → 화면 미포함.
 *   - 출력 = CSV만(client-side Blob, /dashboard/audit 선례). 인쇄 PDF 제외.
 *   - itemId 미지정 시 빈 화면 금지 → 재고 목록 유도.
 *
 * 신규 route 정당성: /dashboard/audit 는 ADMIN/manager 게이트라 일반 연구원 열람 불가 +
 *   목적이 거버넌스 → 재고 운영 기록 전수(GMP 추적성)는 대체 불가. 감사 기능 복제 금지.
 *
 * canonical truth lock (회귀 0):
 *   - 화면·라우트 read-only(mutation 0), 재고 ownership(owner/orgMember) 게이트 유지.
 *   - 브리핑 movements 호출 계약 무회귀.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SCREEN = "src/app/dashboard/inventory/history/page.tsx";
const MOVEMENTS_ROUTE = "src/app/api/inventory/[id]/movements/route.ts";
const MOVEMENTS_HOOK = "src/hooks/use-inventory-movements.ts";
const PANEL = "src/components/inventory/inventory-context-panel.tsx";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");
const exists = (rel: string) => existsSync(resolve(process.cwd(), rel));

describe("§inventory-history-screen P2 — movements 계약 확장", () => {
  it("기간(from/to) + offset 페이지네이션 + total 반환", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toMatch(/searchParams\.get\("from"\)/);
    expect(src).toMatch(/searchParams\.get\("to"\)/);
    expect(src).toMatch(/searchParams\.get\("offset"\)/);
    expect(src).toMatch(/total/);
  });

  it("브리핑 기본값 보존(기본 5건) — 회귀 0", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toMatch(/DEFAULT_LIMIT\s*=\s*5/);
  });

  it("전수 페이지용 상한 상향 + 무제한 조회 금지", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toMatch(/MAX_LIMIT\s*=\s*(\d{2,4})/);
    expect(src).toMatch(/Math\.min/);
  });

  it("ownership 게이트·읽기 전용 유지", () => {
    const src = read(MOVEMENTS_ROUTE);
    expect(src).toContain("productInventory.findUnique");
    expect(src).toContain("organizationMember");
    expect(src).toContain("403");
    expect(src).not.toMatch(/\.create\(|\.update\(|\.delete\(|\.upsert\(/);
  });

  it("깊은 페이지 무성 오정렬 금지 — 스캔 상한 초과 시 truncated 신호", () => {
    const route = read(MOVEMENTS_ROUTE);
    expect(route).toMatch(/SCAN_CAP/);
    expect(route).toMatch(/truncated/);
    const hook = read(MOVEMENTS_HOOK);
    expect(hook).toMatch(/truncated/);
    const screen = read(SCREEN);
    expect(screen).toMatch(/truncated/);
    expect(screen).toMatch(/순서를 보장할 수 없습니다/); // 사용자 안내(조용한 truncation 금지)
  });

  it("훅이 확장 옵션(기간·offset) 전달", () => {
    const src = read(MOVEMENTS_HOOK);
    expect(src).toMatch(/from/);
    expect(src).toMatch(/to/);
    expect(src).toMatch(/offset/);
  });
});

describe("§inventory-history-screen P3 — 화면", () => {
  it("화면 파일 존재", () => {
    expect(exists(SCREEN)).toBe(true);
  });

  it("itemId 프리셀렉트(query 파싱)", () => {
    const src = read(SCREEN);
    expect(src).toContain("useSearchParams");
    expect(src).toMatch(/get\("itemId"\)/);
  });

  it("기간 전체 기본 + 기간 필터 존재", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/전체 기간|기간 전체/);
    expect(src).toMatch(/from|시작/);
    expect(src).toMatch(/to|종료/);
  });

  it("CSV 출력(client-side Blob, 신규 endpoint 0)", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/CSV|csv/);
    expect(src).toContain("Blob");
    expect(src).toContain("createObjectURL");
    expect(src).not.toMatch(/\/api\/inventory\/.*\/export/);
  });

  it("페이지네이션 존재", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/offset|page/);
    expect(src).toMatch(/이전|다음/);
  });

  it("상태 4종 — 로딩·에러·0건·itemId 미지정 폴백(빈 껍데기 금지)", () => {
    const src = read(SCREEN);
    expect(src).toMatch(/isLoading/);
    expect(src).toMatch(/isError|오류|실패/);
    expect(src).toMatch(/기록이 없|없습니다/);
    expect(src).toContain("/dashboard/inventory"); // 미지정 시 재고 목록 유도
  });

  it("범위 준수 — 수정 이력·PDF·mutation 미도입", () => {
    const src = read(SCREEN);
    // ※ 역할 경계 주석의 "수정 이력" 언급은 허용 — 실제 사용(훅·모델 조회)만 금지.
    expect(src).not.toMatch(/dataAuditLog/);
    expect(src).not.toMatch(/useInventoryHistory/);
    expect(src).not.toMatch(/\/history["'`]\s*\)/); // audit history API 호출 금지
    expect(src).not.toMatch(/generate-pdf|pdfkit/);
    expect(src).not.toMatch(/method:\s*["'](POST|PATCH|DELETE)["']/);
  });

  it("§9 신호등 — amber/orange 0", () => {
    const src = read(SCREEN);
    expect(src).not.toMatch(/\bamber-\d|\borange-\d/);
  });
});

describe("§inventory-history-screen P4 — 브리핑 배선(dead button/link 해소)", () => {
  // ⚠️ 주석 텍스트 오탐 방지 — 실제 JSX 배선(testid + href 템플릿)만 통과시킨다.
  it("`입·출고 기록` 버튼 생성 + 이력 화면 딥링크(실배선)", () => {
    const src = read(PANEL);
    expect(src).toContain('data-testid="inventory-context-history-button"');
    expect(src).toMatch(/href=\{`\/dashboard\/inventory\/history\?itemId=\$\{/);
  });

  it("최근 입출고 하단 `전체 이력 보기 ›` 딥링크(실배선)", () => {
    const src = read(PANEL);
    expect(src).toContain('data-testid="inventory-context-history-link"');
    expect(src).toMatch(/전체 이력 보기/);
  });

  it("딥링크는 Link 컴포넌트 경유(하드 네비게이션·no-op 금지)", () => {
    const src = read(PANEL);
    expect(src).toMatch(/import Link from "next\/link"/);
  });

  it("구 '미구현으로 미생성' 유예 주석 제거(stale 방지)", () => {
    const src = read(PANEL);
    expect(src).not.toMatch(/미구현으로 미생성/);
    expect(src).not.toMatch(/구현 후 배선\(dead-link 금지, 현재 미생성\)/);
  });
});
