/**
 * §ai-insight-role-fix (호영님 P1, bug-hunter) — 운영 리포트 역할 오게이트 봉합.
 *
 * 증상: "운영 리포트" 클릭 → "현재 역할로는 이 작업을 실행할 수 없습니다"(ROLE_INSUFFICIENT 403).
 * 근본: /api/analytics/ai-insight 가 action='sensitive_data_export'(buyer/ops_admin 한정) 오분류.
 *   운영 리포트는 자기 조직 데이터의 읽기전용 AI 요약(원본 export 아님) + targetEntityType='ai_action' 자기모순.
 * Fix: action → 'ai_action_create'(전 역할 허용, server-authorization-guard 정책). enforceAction 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const ROUTE = "src/app/api/analytics/ai-insight/route.ts";
const GUARD = "src/lib/security/server-authorization-guard.ts";

describe("§ai-insight-role-fix — 운영 리포트 액션 재분류", () => {
  it("ai-insight 라우트 action = 'ai_action_create'(전 역할 허용)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/action:\s*'ai_action_create'/);
  });
  it("오분류 'sensitive_data_export' 미사용", () => {
    expect(read(ROUTE)).not.toMatch(/action:\s*'sensitive_data_export'/);
  });
  it("targetEntityType 'ai_action' 정합 + enforceAction 유지(인증·CSRF·audit)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/targetEntityType:\s*'ai_action'/);
    expect(src).toMatch(/enforceAction\(/);
    expect(src).toMatch(/enforcement\.allowed/); // 게이트 자체는 보존(우회 아님)
  });
  it("정책상 ai_action_create 는 전 역할 허용(requester 포함) — 회귀 가드", () => {
    const guard = read(GUARD);
    expect(guard).toMatch(/ai_action_create:\s*\[[^\]]*'requester'[^\]]*\]/);
    // sensitive_data_export 는 여전히 buyer/ops_admin 한정(실 export 게이트 보존)
    expect(guard).toMatch(/sensitive_data_export:\s*\[[^\]]*'ops_admin'[^\]]*\]/);
  });
});
