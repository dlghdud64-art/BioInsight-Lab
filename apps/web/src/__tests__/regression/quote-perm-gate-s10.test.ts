/**
 * §quote-perm-gate (지시문 §10) — 비교·스캔 권한 dead-end 제거
 *
 * 증상(라이브): "견적서 비교" 클릭 → 모달 먼저 열림 → 서버 403(역할 부족) → 빨간 에러박스 dead-end.
 *   지시문 §10 위반("빨강 에러박스가 아니라 품위 있는 권한 안내").
 * Fix: ① 조직 미소속 사전체크(모달 열기/ API 호출 전) ② 403도 빨간 에러 대신 품위 안내
 *   ③ 안내 = 잠금 + 현재/필요 권한 + 실 CTA(조직 만들기·참여 → /dashboard/organizations, dead button 0).
 *   비교·스캔 공통. 운영 wiring(runAiQuoteCompare·스캔 모달) 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");
const NOTICE = readFileSync(resolve(__dirname, "../../components/quotes/permission-notice.tsx"), "utf8");

describe("§quote-perm-gate — PermissionNotice 컴포넌트(§10 품위 안내)", () => {
  it("잠금 아이콘 + 현재/필요 권한 + 조직 CTA(/dashboard/organizations) — dead button 0", () => {
    expect(NOTICE).toMatch(/Lock/);
    expect(NOTICE).toMatch(/currentRole/);
    expect(NOTICE).toMatch(/neededLabel/);
    expect(NOTICE).toMatch(/href="\/dashboard\/organizations"/);
  });
  it("빨간 에러박스 패턴 부재(품위 안내만)", () => {
    expect(NOTICE).not.toMatch(/bg-red-50|text-red-600|border-red-200/);
  });
});

describe("§quote-perm-gate — 사전체크(조직 미소속) + 403 전환", () => {
  it("usePermission organizationId/role 사용", () => {
    expect(PAGE).toMatch(/const \{ organizationId: permOrganizationId, role: permRole \} = usePermission\(\)/);
  });
  it("compare 사전체크 — 조직 없으면 모달 안 열고 안내", () => {
    expect(PAGE).toMatch(/if \(!permOrganizationId\) \{ setPermGate\("compare"\); return; \}/);
  });
  it("compare 403 — 빨간 에러 대신 안내로 전환(모달 닫기)", () => {
    expect(PAGE).toMatch(/res\.status === 403[\s\S]{0,80}setAiCompareOpen\(false\)[\s\S]{0,40}setPermGate\("compare"\)/);
  });
  it("scan 사전체크 — handleScanOpen 조직 게이트", () => {
    expect(PAGE).toMatch(/const handleScanOpen = useCallback\(\(\) => \{[\s\S]{0,160}setPermGate\("scan"\)/);
    expect(PAGE).toMatch(/onClick=\{handleScanOpen\}/);
  });
  it("권한 안내 Dialog + PermissionNotice 렌더", () => {
    expect(PAGE).toMatch(/permGate !== null/);
    expect(PAGE).toMatch(/<PermissionNotice/);
  });
});

describe("§quote-perm-gate — 회귀 0(운영 wiring 보존)", () => {
  it("runAiQuoteCompare + 스캔 모달 보존", () => {
    expect(PAGE).toMatch(/const runAiQuoteCompare = useCallback/);
    expect(PAGE).toMatch(/<AiQuoteParseModal/);
  });
  it("스캔 직접 오픈(게이트 우회) 부재 — 모든 진입이 handleScanOpen 경유", () => {
    expect(PAGE).not.toMatch(/onClick=\{\(\) => setAiParseModalOpen\(true\)\}/);
  });
});
