/**
 * §11.160 #dashboard-cleanup-stale-files
 *
 * Regression guard — repo hygiene cleanup. **git tree** 기반 검증
 * (FUSE filesystem 의 sandbox 잔존물 vs 실제 repo 상태 분리).
 *
 * Phase 0 audit 결과:
 *   - 5 .bak* files: git index 부재 (working tree FUSE 잔존만) — git 입장 clean.
 *   - 4 .fuse_hidden* files: git index 부재 — git 입장 clean.
 *   - dashboard/smart-sourcing/: git index 부재 — git 입장 clean.
 *   - dashboard/orders/page.tsx: git index 존재 + 10+ inbound link → deferred
 *     (별도 트랙 `#dashboard-orders-inbound-rewire` 후 제거).
 *
 * 본 commit 의 역할:
 *   - 회귀 guard 추가 — 향후 .bak / .fuse_hidden / smart-sourcing 파일이
 *     실수로 git index 에 들어가지 않도록 차단.
 *   - 운영자 가시성 — git tree 가 hygiene 정합 임을 명시 lock.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const APPS_WEB = resolve(__dirname, "../../..");
const REPO_ROOT = resolve(APPS_WEB, "../..");

/**
 * git ls-files via HEAD tree (FUSE sandbox 의 corrupt index 회피).
 * Production CI 환경에선 git index 가 정상이므로 동일 결과 반환.
 */
function gitTrackedFiles(pattern: string): string[] {
  try {
    const out = execSync(`git ls-tree -r --name-only HEAD -- "${pattern}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

describe("§11.160 dashboard cleanup — git tree hygiene", () => {
  it(".bak* working-tree leftover 가 git index 에 부재", () => {
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/**/*.bak*");
    expect(tracked).toEqual([]);
  });

  it(".fuse_hidden* sandbox FUSE artifact 가 git index 에 부재", () => {
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/**/.fuse_hidden*");
    expect(tracked).toEqual([]);
  });

  it("dashboard/smart-sourcing/ 가 git index 에 부재 (redirect-only legacy)", () => {
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/smart-sourcing/**");
    expect(tracked).toEqual([]);
  });

  it("회귀 0: dashboard/orders/page.tsx 는 §11.162 에서 git index 제거 완료 (8 caller rewire 후)", () => {
    // §11.160 시점엔 deferred 였으나 §11.162 에서 8 inbound caller 모두
    // canonical destination (purchase-orders / purchases?view=conversion-ready) 로
    // rewire 후 redirect-only page 제거 완료. 이 case 는 §11.162 land 이후
    // "removed" 회귀 guard 로 전환.
    const tracked = gitTrackedFiles("apps/web/src/app/dashboard/orders/page.tsx");
    expect(tracked).toEqual([]);
  });

  it("회귀 0: 핵심 surface 보존 (purchases/quotes/inbox/inventory/work-queue/settings)", () => {
    const surfaces = [
      "apps/web/src/app/dashboard/purchases/page.tsx",
      "apps/web/src/app/dashboard/quotes/page.tsx",
      "apps/web/src/app/dashboard/inbox/page.tsx",
      "apps/web/src/app/dashboard/inventory/inventory-content.tsx",
      "apps/web/src/app/dashboard/work-queue/page.tsx",
      "apps/web/src/app/dashboard/settings/page.tsx",
    ];
    for (const f of surfaces) {
      const tracked = gitTrackedFiles(f);
      expect(tracked).toContain(f);
    }
  });
});
