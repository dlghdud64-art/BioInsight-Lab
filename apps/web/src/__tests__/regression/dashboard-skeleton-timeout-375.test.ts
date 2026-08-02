/**
 * §11.375 Phase 1 (RED→GREEN) — 대시보드 스켈레톤 상한 완화
 *
 * 증상(호영님 prod): 첫 진입 시 stats 가 cold latency 로 5~6초 걸림(에러 아님,
 *   느린 성공). 기존 §11.366 6초 상한에 걸려 "지연 발생/다시시도" 에러 카드가
 *   잠깐 깜빡인 뒤 정상 화면 복귀.
 *
 * Fix(Phase 1): 상한 6초 → 10초. cold 5~6초는 상한 전에 회복 → 에러 카드 미노출.
 *   진짜 무한(auth hang)만 10초 후 에러 카드. 서버 무관·회귀 0.
 *   (근본 절감은 Phase 2+ stats slimming.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const PAGE = "src/app/dashboard/page.tsx";

describe("§11.375 P1 — 스켈레톤 상한 10초", () => {
  it("loadTimedOut 타이머가 10000ms", () => {
    const src = read(PAGE);
    expect(src).toMatch(/setLoadTimedOut\(true\), 10000\)/);
  });

  it("기존 6초 상한 제거", () => {
    const src = read(PAGE);
    expect(src).not.toMatch(/setLoadTimedOut\(true\), 6000\)/);
  });
});

describe("§11.375 P1 — 회귀 0", () => {
  it("loadTimedOut state + 회복 시 reset 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/const \[loadTimedOut, setLoadTimedOut\] = useState\(false\)/);
    expect(src).toMatch(/if \(!stillLoading\) \{ setLoadTimedOut\(false\); return; \}/);
  });

  it("다시 시도 refetchStats 경로 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/refetchStats\(\)/);
  });
});
