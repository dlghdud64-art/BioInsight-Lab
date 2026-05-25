import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("mobile offline sync - human gate", () => {
  const home = read("apps/mobile/app/(tabs)/index.tsx");
  const offline = read("apps/mobile/lib/offline/index.ts");
  const manager = read("apps/mobile/lib/offline/sync-manager.ts");

  it("대기 작업은 사용자가 확인하는 CTA로만 반영한다", () => {
    expect(home).toMatch(/확인 후 동기화/);
    expect(home).toMatch(/onPress=\{handleConfirmedSync\}/);
    expect(home).toMatch(/triggerSync/);
  });

  it("재연결이나 앱 복귀가 mutation queue를 실행하지 않는다", () => {
    const networkHandler = manager.match(/function handleNetworkChange[\s\S]*?\n\}/)?.[0] ?? "";
    const startManager = manager.match(/export function startSyncManager[\s\S]*?\n\}/)?.[0] ?? "";
    expect(networkHandler).not.toMatch(/runSync\(\)/);
    expect(manager).not.toMatch(/handleAppStateChange|AppState\.addEventListener/);
    expect(startManager).not.toMatch(/runSync\(\)/);
    expect(manager).not.toMatch(/if \(_isOnline\) runSync\(\)/);
    expect(manager).toMatch(/return runSync\(\)/);
  });

  it("자동 반영으로 오해할 안내 문구를 노출하지 않는다", () => {
    expect(home).not.toMatch(/자동\s*전송|자동\s*적용|자동\s*확정/);
    expect(offline).not.toMatch(/자동\s*전송|자동\s*적용|자동\s*확정/);
  });
});
