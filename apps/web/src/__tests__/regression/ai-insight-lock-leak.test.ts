import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §11.369-2 — 운영 리포트(ai-insight) stale-lock 봉합.
//   enforceAction lock 획득 후 complete()/fail() 미호출 → lock leak → TTL 까지 409.
//   targetEntityId 'unknown' 고정 → 전역 단일 lock(cross-user 충돌).

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_WEB, rel), "utf8");
const ROUTE = "src/app/api/analytics/ai-insight/route.ts";

describe("§11.369-2 — ai-insight lock 해제 보장(stale-lock 봉합)", () => {
  it("성공 경로 enforcement.complete() 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/enforcement\.complete\(/);
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
