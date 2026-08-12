import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §11.369-2 — 운영 리포트(ai-insight) stale-lock 봉합.
//   enforceAction lock 획득 후 complete()/fail() 미호출 → lock leak → TTL 까지 409.
//   targetEntityId 'unknown' 고정 → 전역 단일 lock(cross-user 충돌).
//
// ⚠️ 2026-08-12 **승계** (§audit-foundation ①) — 정책은 그대로, 수단이 바뀌었다.
//   §11.369-2 가 지키려던 것은 **lock 해제 보장**이다. 그 목적은 complete() 로도
//   fail() 로도 달성된다(둘 다 failMutation 을 부른다).
//   그런데 이 핸들러는 findMany 2회 + AI 호출만 하고 **DB 쓰기가 0** 이다.
//   complete() 는 인자가 없어도 audit envelope 을 append 하므로
//   (beforeState/afterState 가 status: pending→completed 기본값) 영속화 이후
//   "이 사용자가 이것을 변경했다" 는 **거짓 감사 기록**이 된다.
//   → 성공 경로를 fail() 로 교정하고, 이 sentinel 의 첫 단언도 fail() 로 승계한다.
//   **lock 해제 보장이라는 원 계약은 유지된다** — 오히려 강화된다(E8 이 재발 감시).
//
//   ⚠️ 절차 반성: 이 승계 없이 코드만 바꿔 이 sentinel 을 RED 로 만들었고,
//   ops 서브셋만 돌려 보고해 놓쳤다(§test-baseline-debt).

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_WEB, rel), "utf8");
const ROUTE = "src/app/api/analytics/ai-insight/route.ts";

describe("§11.369-2 — ai-insight lock 해제 보장(stale-lock 봉합)", () => {
  it("성공 경로 lock 해제 보장 — 쓰기 0 이므로 fail() (§audit-foundation ① 승계)", () => {
    const src = read(ROUTE);
    // 원 계약(lock 해제)은 유지, 수단만 complete() → fail().
    expect(src).toMatch(/enforcement\.fail\(\)/);
    // 거짓 audit 방지 — 읽기 전용 핸들러가 complete() 를 부르면 안 된다.
    expect(src).not.toMatch(/enforcement\.complete\(/);
  });

  it("실패 경로 enforcement.fail() 호출(catch)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/enforcement\??\.fail\(\)/);
  });

  it("targetEntityId per-user(session.user.id) — 'unknown' 전역 lock 금지", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/targetEntityId:\s*session\.user\.id/);
    expect(src).not.toMatch(/targetEntityId:\s*['"]unknown['"]/);
  });
});
