/**
 * §mobile-logs P1 #contract-sentinel — 모바일 활동 로그 · 전역 드롭다운 개선
 *
 * 계획서: docs/plans/PLAN_mobile-logs.md (P0 ✅ Truth Lock 2026-07-21, 커밋 5685c75f).
 *
 * P0 확정 truth:
 *   - 통합 host = dashboard/audit/page.tsx (§log-consolidation 존중 — 새 페이지 0).
 *   - 현재 탭 = URL `?tab=` 단일 소스(하드코딩 제거). 초기 모드 useEffect(L367-373)가 수정 지점.
 *   - 행 딥링크 = 기존 오버레이 규약(`?overlay=`, hooks/use-overlay-deep-link.ts) 재사용 —
 *     신규 `[id]` 라우트 금지. 규약 없는 도메인은 목록 라우트+필터 폴백(dead link 0).
 *   - 전역 드롭다운 토큰 = components/ui/select.tsx 만(trigger L29·content L85 `bg-el` 2곳).
 *     dropdown-menu/popover 무접촉.
 *   - 비admin 감사 강등 메커니즘(L378-392) 무접촉 보존.
 *
 * 이 파일 = QA 10항(핸드오프 §4) 정적 계약 + 회귀 0 가드.
 *   계약 : "계약" describe — P1 에서 RED(미구현), P2/P3/P4 구현 후 GREEN.
 *   GUARD: "회귀 0" describe — 현재 GREEN, P2~P4 편집 후에도 GREEN 유지 강제.
 *
 * 검증: 격리 node 로 패턴 확인(sandbox read-only) → operator-shell 실 vitest(F9) + push.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// __dirname = apps/web/src/__tests__/regression → up 3 = apps/web
const REPO_ROOT = join(__dirname, "..", "..", "..");
const AUDIT_PATH = "src/app/dashboard/audit/page.tsx";
const MORE_SHEET_PATH = "src/components/layout/bottom-nav-more-sheet.tsx";
const SELECT_PATH = "src/components/ui/select.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// ────────────────────────────────────────────────────────────────────
// 계약 P2 — 라우팅 · 메뉴 (QA①②③: 활동 진입 버그 해소 · 탭 = URL · 메뉴 1항목)
// ────────────────────────────────────────────────────────────────────
describe("§mobile-logs P2 계약 — 탭 = URL ?tab= 단일 소스", () => {
  it("통합 host 가 useSearchParams 로 tab 파라미터 읽기 (기본 탭 하드코딩 0)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/useSearchParams/);
    expect(src).toMatch(/\.get\(\s*["']tab["']\s*\)/);
  });

  it("초기 모드: tab 파라미터 우선 반영 (?tab=activity → 활동 탭 진입)", () => {
    const src = read(AUDIT_PATH);
    // tab 값이 setMode 분기에 실사용 — 읽기만 하고 버리는 가짜 반영 금지.
    expect(src).toMatch(
      /\.get\(\s*["']tab["']\s*\)[\s\S]{0,600}setMode|setMode[\s\S]{0,600}\.get\(\s*["']tab["']\s*\)/,
    );
  });
});

describe("§mobile-logs P2 계약 — 더보기 메뉴 통합 (활동 로그 1항목)", () => {
  it("더보기 활동 로그 = 통합 host 탭 딥링크 (/dashboard/audit?tab=activity)", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).toContain("/dashboard/audit?tab=activity");
  });

  it("구 redirect 경유 진입 제거 (href: /dashboard/activity-logs 항목 0)", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).not.toMatch(/href:\s*"\/dashboard\/activity-logs"/);
  });

  it("감사 추적 별도 메뉴 항목 제거 (감사 = 페이지 내 탭, 메뉴 2항목 병렬 회귀 차단)", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).not.toMatch(/label:\s*"감사 추적"/);
  });

  it("하이라이트 = 실제 경로 정합 (query 포함 href 의 pathname 정규화 매칭)", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).toMatch(/\.split\(\s*["']\?["']\s*\)/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 계약 P3 — 필터 한 줄 + 세부 시트 (QA④⑤: 라벨 없는 "전체" 0 · 가짜 필터 0)
// ────────────────────────────────────────────────────────────────────
describe("§mobile-logs P3 계약 — 활동 필터 한 줄 (가로 스크롤)", () => {
  it("필터 한 줄 컨테이너 + 가로 스크롤", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-filter-row"/);
    expect(src).toMatch(
      /data-testid="log-filter-row"[\s\S]{0,300}overflow-x-auto|overflow-x-auto[\s\S]{0,300}data-testid="log-filter-row"/,
    );
  });

  it("도메인 칩 — 기존 ENTITY_TYPE_LABELS 파생 (라벨 맵 신설 0)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-domain-chip-/);
    expect(src).toMatch(
      /ENTITY_TYPE_LABELS[\s\S]{0,800}log-domain-chip-|log-domain-chip-[\s\S]{0,800}ENTITY_TYPE_LABELS/,
    );
  });
});

describe("§mobile-logs P3 계약 — 세부 필터 바텀 시트 (멀티 = 시트)", () => {
  it("세부 시트 실재 + 바텀 시트 규약", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-filter-sheet"/);
    expect(src).toMatch(
      /data-testid="log-filter-sheet"[\s\S]{0,400}side="bottom"|side="bottom"[\s\S]{0,400}data-testid="log-filter-sheet"/,
    );
  });

  it("적용 CTA = `필터 적용 · N개` (선택 수 실반영 — 가짜 필터 0)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toContain("필터 적용 · ");
  });

  it("활성 필터 칩 ✕ 해제 실동작", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-filter-active-chip"/);
  });

  it("시트 항목 터치 44px+ (h-11 / min-h-[44px])", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(
      /data-testid="log-filter-sheet"[\s\S]{0,3000}(h-11|min-h-\[44px\])/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// 계약 P4 — 리스트 (QA⑥: 날짜 그룹 · 이니셜 칩 · 행 딥링크 = 눌리지 않는 행 0)
// ────────────────────────────────────────────────────────────────────
describe("§mobile-logs P4 계약 — 활동 리스트 날짜 그룹 + 행 딥링크", () => {
  it("날짜 그룹 헤더 (오늘/어제/날짜)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-date-group"/);
    expect(src).toContain("어제");
  });

  it("도메인 이니셜 칩", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-entity-initial"/);
  });

  it("행 탭 딥링크 — 기존 오버레이 규약(?overlay=) 재사용, 신규 [id] 라우트 0", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-row-link"/);
    expect(src).toMatch(/overlay=/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 계약 P4 — 전역 select 토큰 (QA⑦⑧: 흰 패널+그림자+44px+선택 ✓ · 회색 패널 0)
// ────────────────────────────────────────────────────────────────────
describe("§mobile-logs P4 계약 — 전역 select 흰 패널 토큰 (진단 ④)", () => {
  it("회색 채색 bg-el 0 (trigger L29 · content L85 교정)", () => {
    const src = read(SELECT_PATH);
    expect(src).not.toMatch(/bg-el/);
  });

  it("패널 그림자 토큰 (0 12px 32px rgba(15,23,42,.14))", () => {
    const src = read(SELECT_PATH);
    expect(src).toMatch(/rgba\(15,\s?23,\s?42/);
  });

  it("선택 항목 ✓ 강조 (#eff6ff / #1d4ed8)", () => {
    const src = read(SELECT_PATH);
    expect(src).toMatch(/eff6ff/i);
    expect(src).toMatch(/1d4ed8/i);
  });

  it("항목 44px 터치 높이", () => {
    const src = read(SELECT_PATH);
    expect(src).toMatch(/min-h-\[44px\]/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 🟢 회귀 0 — 통합 host · 강등 메커니즘 · 데이터 계약 보존 (현재 GREEN 유지)
// ────────────────────────────────────────────────────────────────────
describe("§mobile-logs P1 GUARD — 통합 host + 강등 메커니즘 보존", () => {
  it("모드토글 testid 3종 유지 (통합 surface 구조)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-mode-toggle"/);
    expect(src).toMatch(/data-testid="log-mode-activity"/);
    expect(src).toMatch(/data-testid="log-mode-audit"/);
  });

  it("canAccessAudit 게이트 정의 유지 (ADMIN + manager)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/const\s+canAccessAudit\s*=/);
    expect(src).toMatch(/userRole\s*===\s*"ADMIN"/);
  });

  it("비admin 감사 강등 메커니즘 무접촉 (toast 안내 + 활동 강등)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/감사 추적은 관리자만 열람할 수 있습니다/);
    expect(src).toMatch(/setMode\("activity"\)/);
  });
});

describe("§mobile-logs P1 GUARD — 데이터 계약 보존 (모델 무접촉)", () => {
  it("활동 = /api/activity-logs · 감사 = /api/audit-logs 읽기 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/\/api\/activity-logs/);
    expect(src).toMatch(/\/api\/audit-logs/);
  });

  it("라벨 맵 재사용 (ENTITY_TYPE_LABELS · ACTIVITY_TYPE_LABELS — raw enum 노출 0)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/ENTITY_TYPE_LABELS/);
    expect(src).toMatch(/ACTIVITY_TYPE_LABELS/);
  });

  it("활동 = org 멤버 열람 유지 (enabled: status authenticated)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/enabled:\s*status\s*===\s*"authenticated"/);
  });

  it("감사 GMP timestamp 표기 유지 (Asia/Seoul + KST)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/timeZone:\s*"Asia\/Seoul"/);
    expect(src).toMatch(/KST/);
  });
});

describe("§mobile-logs P1 GUARD — select.tsx §11.73 인터랙션 보존", () => {
  it("hover lift + open 강조 유지 (전역 토큰 교정 시 §11.73 소실 금지)", () => {
    const src = read(SELECT_PATH);
    expect(src).toMatch(/hover:border-blue-300/);
    expect(src).toMatch(/data-\[state=open\]:border-blue-400/);
  });

  it("bg-popover 기반 + ItemIndicator(Check) 유지", () => {
    const src = read(SELECT_PATH);
    expect(src).toMatch(/bg-popover/);
    expect(src).toMatch(/ItemIndicator/);
  });
});

describe("§mobile-logs P1 GUARD — 더보기 시트 기존 동선 보존", () => {
  it("§11.359 로그아웃 진입점 유지", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).toContain("로그아웃");
    expect(src).toMatch(/handleSignOut/);
  });

  it("§11.359-2 대시보드 바로가기(exact) + 닫기 동선 유지", () => {
    const src = read(MORE_SHEET_PATH);
    expect(src).toMatch(/href:\s*"\/dashboard",\s*icon:\s*LayoutDashboard,\s*exact:\s*true/);
    expect(src).toMatch(/aria-label="메뉴 닫기"/);
  });
});
