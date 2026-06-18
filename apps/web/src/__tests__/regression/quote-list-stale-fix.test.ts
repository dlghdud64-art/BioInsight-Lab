/**
 * §quote-list-stale-fix(호영님 버그, 2026-06-18) — 견적 생성 후 /dashboard/quotes stale
 *
 * 증상: 검색→견적 생성(RequestWizardModal) 후 /dashboard/quotes 도착 시 새 견적 미노출,
 *   새로고침해야 뜸("추가 안 됐나?" 오인). dead button 아님 — 캐시 미갱신.
 * 진단(bug-hunter): 목록은 React Query useQuery(["quotes", statusFilter]). 생성 경로
 *   request-wizard-modal 은 queryClient 자체가 없어 생성 성공 후 invalidate 0 →
 *   search 가 router.push("/dashboard/quotes") 해도 stale 캐시 표시. router.refresh()는
 *   RSC용이라 client useQuery 캐시엔 무효 → 정답은 invalidateQueries(["quotes"]).
 * 수정: 생성 성공(submittedId 확보) 직후 invalidate. prefix 매칭으로 statusFilter 변형 전부 갱신.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SRC = readFileSync(
  join(ROOT, "app/_workbench/_components/request-wizard-modal.tsx"),
  "utf8",
);

describe("§quote-list-stale-fix — 생성 후 목록 캐시 무효화", () => {
  it("useQueryClient import + hook", () => {
    expect(SRC).toMatch(/import \{ useQueryClient \} from "@tanstack\/react-query"/);
    expect(SRC).toMatch(/const queryClient = useQueryClient\(\)/);
  });
  it("생성 성공 직후 invalidateQueries(['quotes']) — 목록 prefix 매칭", () => {
    expect(SRC).toMatch(/queryClient\.invalidateQueries\(\{ queryKey: \["quotes"\] \}\)/);
  });
});

describe("§quote-list-stale-fix — 회귀 0(fake success 가드 보존)", () => {
  it("§11.52 fake success 제거 + submittedId narrowing 보존", () => {
    expect(SRC).toMatch(/if \(!res\.ok\)/);
    expect(SRC).toMatch(/const submittedId = json\.quote\?\.id \?\? json\.id/);
  });
  it("invalidate 는 생성 성공(submittedId) 후에만 — fake success 금지", () => {
    const idxId = SRC.indexOf("setSubmittedRequestId(submittedId)");
    const idxInval = SRC.indexOf('invalidateQueries({ queryKey: ["quotes"] })');
    expect(idxId).toBeGreaterThan(-1);
    expect(idxInval).toBeGreaterThan(idxId);
  });
});
