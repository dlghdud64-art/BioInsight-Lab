import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §ai-insight-dialog null-safety — 빈 계정 온보딩 크래시 봉합 sentinel.
//   배치: src/__tests__/regression/ (REPO_WEB = 3단계 상승).
//   호영님 bug-hunter root cause: ai-insight-dialog.tsx:186
//   `insight.dataPoints.toLocaleString("ko-KR")` — 빈 계정 응답(route:77-80
//   {summary, generated:false}) 에 dataPoints 누락 → undefined.toLocaleString throw.

const REPO_WEB = join(__dirname, "..", "..", "..");
const DIALOG = "src/components/dashboard/ai-insight-dialog.tsx";
const read = () => readFileSync(join(REPO_WEB, DIALOG), "utf8");

describe("§ai-insight-dialog — 빈 계정 null-safety (온보딩 크래시 봉합)", () => {
  it("dataPoints toLocaleString 가드 — 무가드 직접 호출 부재", () => {
    const src = read();
    // insight.dataPoints.toLocaleString 직접(가드 없이) 호출 시 RED
    expect(src).not.toMatch(/insight\.dataPoints\.toLocaleString/);
  });
  it("dataPoints null 가드 분기 존재", () => {
    // local 추출(`const dp = insight.dataPoints; if (dp == null ...`) 또는 직접
    //   (`insight.dataPoints != null`) 양방 매치 — null 비교 분기 존재 정합.
    expect(read()).toMatch(/dataPoints[\s\S]{0,120}[!=]=\s*null/);
  });
  it("dataPoints optional 타입(빈 응답 정합)", () => {
    expect(read()).toMatch(/dataPoints\?:\s*number/);
  });
});
