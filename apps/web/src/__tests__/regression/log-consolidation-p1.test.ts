/**
 * §log-consolidation P1 #contract-sentinel — 활동 로그 + 감사 추적 → 단일 로그 surface
 *
 * 계획서: docs/plans/PLAN_log-consolidation.md (P0 ✅ truth lock).
 *
 * P0 확정 truth:
 *   - 활동 로그 = 실 ActivityLog (`/api/activity-logs`, org 멤버 열람) — mock 아님.
 *   - 감사 추적 = 실 AuditLog (`/api/audit-logs`, admin-gate + GMP Part 11 + PDF/CSV export).
 *   - 통합 = 단일 route + 모드토글, 각 모드가 자기 모델 읽기(모델 병합/migration 없음).
 *   - 권한 비대칭: 활동=org멤버 / 감사=admin → 모드토글 권한 분기 필수.
 *   - 통합 host = canonical 감사 surface (dashboard/audit/page.tsx).
 *
 * 이 파일은 단일 로그 surface 계약 + 회귀 0 가드다.
 *   계약 : "단일 surface 모드토글 계약" describe — P1 에서 RED(미구현),
 *          P2(통합 surface 구현) 후 GREEN.
 *   GUARD: "회귀 0" describe 들 — 감사 컴플라이언스·활동 모델 보존.
 *
 * P2 갱신: 페이지 단위 wholesale redirect(router.replace("/dashboard")) 가
 *   통합 surface 와 비양립(비admin 도 활동 모드 진입 필요) → admin-gate 의 의미
 *   (비admin 의 감사 데이터 비노출)는 "감사 모드 권한 강등" 메커니즘으로 보존.
 *   해당 GUARD assertion 을 redirect → setMode("activity") 로 진화(의도 동일).
 *
 * 검증: 격리 node 로 패턴 확인 → operator-shell 실 vitest + push.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// __dirname = apps/web/src/__tests__/regression → up 3 = apps/web
const REPO_ROOT = join(__dirname, "..", "..", "..");
const AUDIT_PATH = "src/app/dashboard/audit/page.tsx";
const ACTIVITY_PATH = "src/app/dashboard/activity-logs/page.tsx";
const SIDEBAR_PATH = "src/app/_components/dashboard-sidebar.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// ────────────────────────────────────────────────────────────────────
// 계약 — 단일 surface 모드토글 (P1 RED → P2 GREEN)
// ────────────────────────────────────────────────────────────────────
describe("§log-consolidation — 단일 로그 surface 모드토글 계약", () => {
  it("통합 host(감사 surface)에 모드토글 컨테이너 노출", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-mode-toggle"/);
  });

  it("모드토글: 활동 모드 탭", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-mode-activity"/);
  });

  it("모드토글: 감사 모드 탭", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-mode-audit"/);
  });

  it("활동 모드가 자기 모델(ActivityLog) 읽기 — /api/activity-logs 흡수 (모델 병합 없음)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/\/api\/activity-logs/);
  });

  it("권한 분기: 감사 모드 탭이 canAccessAudit 게이트 뒤에서만 노출 (비admin 비노출)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(
      /canAccessAudit[\s\S]{0,240}data-testid="log-mode-audit"|data-testid="log-mode-audit"[\s\S]{0,240}canAccessAudit/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// 🟢 회귀 0 — 감사 컴플라이언스 보존 (규제 리스크, 절대 손실 금지)
// ────────────────────────────────────────────────────────────────────
describe("§log-consolidation P1 GUARD — 감사 admin-gate 보존", () => {
  it("canAccessAudit + ADMIN role 게이트 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/const\s+canAccessAudit\s*=/);
    expect(src).toMatch(/userRole\s*===\s*"ADMIN"/);
  });

  it("비admin 감사모드 차단: 권한 거부 안내 + 활동 모드 강등 (admin-gate 의미 보존)", () => {
    const src = read(AUDIT_PATH);
    // P2: wholesale redirect → 감사 모드 권한 강등 메커니즘(의도 동일).
    expect(src).toMatch(/감사 추적은 관리자만 열람할 수 있습니다/);
    expect(src).toMatch(/setMode\("activity"\)/);
  });

  it("감사 모드 탭은 canAccessAudit 게이트 뒤에서만 노출 (비admin 비노출)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(
      /canAccessAudit[\s\S]{0,240}data-testid="log-mode-audit"/,
    );
  });

  it("canonical 데이터 소스 /api/audit-logs 유지 (UI state 가 truth 대체 금지)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/\/api\/audit-logs/);
  });
});

describe("§log-consolidation P1 GUARD — GMP Part 11 보존", () => {
  it("타임존 명시(Asia/Seoul) + KST 라벨 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/timeZone:\s*"Asia\/Seoul"/);
    expect(src).toMatch(/KST/);
  });

  it("append-only(추가 전용) 보존 안내 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/추가 전용|append-only/);
  });
});

describe("§log-consolidation P1 GUARD — PDF/CSV export 보존 (§11.89)", () => {
  it("정형 PDF export 핸들러 + pdf-view endpoint 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/handleCompliancePdf/);
    expect(src).toMatch(/\/api\/audit-logs\/pdf-view/);
    expect(src).toMatch(/autoPrint/);
  });

  it("CSV export 핸들러 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/handleCsvExport/);
  });

  it("내보내기 트리거 + Sheet(PDF/CSV) testid 유지 (dead button 0)", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="audit-export-trigger"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-pdf"/);
    expect(src).toMatch(/data-testid="audit-actions-sheet-csv"/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 🟢 회귀 0 — 활동 모델(ActivityLog) 보존 + 권한 비대칭(org 멤버)
// ────────────────────────────────────────────────────────────────────
// P3: 구 activity-logs/page.tsx 가 통합 route redirect 로 전환됨 → 활동 데이터
//   읽기 · org 멤버 열람 · 라벨 보존 가드를 통합 host(audit page 활동 모드)로 이전.
//   (정직성 §1-2⑤ + 권한 비대칭 보존 의미는 위치만 이동, 강도 동일.)
describe("§log-consolidation P3 GUARD — 활동 ActivityLog 보존 (통합 host)", () => {
  it("활동 모드가 /api/activity-logs(ActivityLog) 읽기 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/\/api\/activity-logs/);
  });

  it("활동 = org 멤버 열람(admin-gate 아님) — enabled: status authenticated 유지", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/enabled:\s*status\s*===\s*"authenticated"/);
  });

  it("ActivityType 한글 매핑(raw enum 노출 회귀 차단) 유지 — §11.299", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/ACTIVITY_TYPE_LABELS/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 🟢 P3 — 메뉴 1항목 정리 + 구 route redirect (dead link 0)
// ────────────────────────────────────────────────────────────────────
describe("§log-consolidation P3 — 메뉴 통합 + 구 route redirect", () => {
  it("sidebar adminMenuItems 통합 단일 진입(/dashboard/audit)", () => {
    const src = read(SIDEBAR_PATH);
    expect(src).toMatch(/href:\s*"\/dashboard\/audit",\s*icon/);
  });

  it("sidebar 구 활동 로그 별 메뉴 항목 제거 (2항목 회귀 차단)", () => {
    const src = read(SIDEBAR_PATH);
    // NavItem 형태(href: "/dashboard/activity-logs", icon: ...)가 더는 없어야 함.
    // (ICON_TINT 의 "/dashboard/activity-logs": {...} 키 형태는 href: 가 아니라 무관.)
    expect(src).not.toMatch(/href:\s*"\/dashboard\/activity-logs",\s*icon/);
  });

  it("구 route /dashboard/activity-logs → 통합 route redirect", () => {
    const src = read(ACTIVITY_PATH);
    expect(src).toMatch(/from\s+"next\/navigation"/);
    expect(src).toMatch(/redirect\(\s*["']\/dashboard\/audit["']\s*\)/);
  });

  it("구 활동 surface 는 redirect-only (구 client 데이터 fetch 잔존 금지)", () => {
    const src = read(ACTIVITY_PATH);
    expect(src).not.toMatch(/useQuery/);
    expect(src).not.toMatch(/"use client"/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 🟢 P4 — 통합 활동 모드 모바일 정합 + KPI 기능 동등성(구 activity-logs 회복)
// ────────────────────────────────────────────────────────────────────
describe("§log-consolidation P4 — 통합 활동 모드 KPI 기능 동등성", () => {
  it("활동 모드 컴팩트 KPI 그리드(§11.311 grid-cols-3) 노출", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/data-testid="log-activity-kpi-grid"/);
    expect(src).toMatch(/grid-cols-3/);
  });

  it("활동 KPI 분류 헬퍼(isAiActivity/isAlertActivity) 사용 — 구 activity-logs 동등성", () => {
    const src = read(AUDIT_PATH);
    expect(src).toMatch(/isAiActivity/);
    expect(src).toMatch(/isAlertActivity/);
  });
});
