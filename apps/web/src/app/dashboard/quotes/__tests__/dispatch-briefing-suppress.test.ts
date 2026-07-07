import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/quotes/page.tsx";

describe("§ops-briefing-fab — 발송 진행 컨텍스트에서 progress overlay 브리핑 제외", () => {
  it("발송 검토 모달(request_send) 활성 시 closeOverlay 로 중복 브리핑 제거", () => {
    const src = read(PAGE);
    expect(src).toMatch(/const closeOverlay = useOverlayChromeStore\(\(s\) => s\.closeOverlay\)/);
    expect(src).toMatch(/if \(activeWorkWindow === "request_send"\) closeOverlay\(\);/);
  });

  it("store 에 dispatch 상태를 넣지 않음(canonical 경계 — closeOverlay 만 사용)", () => {
    const src = read(PAGE);
    // dispatch readiness/send status 를 overlay store 에 쓰는 패턴이 없어야 함
    expect(src).not.toMatch(/setDispatchReady|store.*sendStatus|overlay.*dispatch/i);
  });
});
