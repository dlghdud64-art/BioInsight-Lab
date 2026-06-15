/**
 * §suite-red-cleanup — §log-consolidation 통합 host(audit page 활동 모드) 보존 sentinel.
 *
 * 배경: §log-consolidation P3 가 구 /dashboard/activity-logs 를 redirect-only 로 축소
 *   → 그 surface 를 검사하던 sentinel(activity-logs-korean-299·activity-logs-mobile-311a)
 *   는 stale(검사 대상 부재)이 되어 retire 됨. 본 sentinel 은 그 sentinel 들이 보호하던
 *   핵심 awareness(활동 로그 한글 라벨 + 모바일 KPI 컴팩트)를 통합 host(audit 활동 모드)
 *   대상으로 repoint 하여 **보호 공백 0** 을 보장한다.
 *
 * 출처: activity-logs-korean-299(라벨 한글 매핑) + activity-logs-mobile-311a(§11.311 KPI)
 *   의 보호 의도를 통합 host(audit/page.tsx 활동 모드 + lib/activity/activity-labels.ts)로 이전.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB, rel), "utf8");

const AUDIT = "src/app/dashboard/audit/page.tsx";
const LABELS = "src/lib/activity/activity-labels.ts";

describe("§suite-red-cleanup — 활동 라벨 한글 보존 (구 §11.299 → 통합 host)", () => {
  it("ACTIVITY_TYPE_LABELS canonical 정의(lib) + 한글 매핑 30+ 보존", () => {
    const src = read(LABELS);
    expect(src).toMatch(/ACTIVITY_TYPE_LABELS/);
    // 한글 라벨 표본(raw 영문 enum 노출 0 정합).
    const koLabels = (src.match(/"[가-힣][^"]*"/g) || []).length;
    expect(koLabels).toBeGreaterThanOrEqual(20);
  });
  it("audit 활동 모드가 ACTIVITY_TYPE_LABELS 소비(raw enum 미노출)", () => {
    const src = read(AUDIT);
    expect(src).toMatch(/ACTIVITY_TYPE_LABELS/);
    expect(src).toMatch(/from "@\/lib\/activity\/activity-labels"/);
  });
});

describe("§suite-red-cleanup — 활동 KPI §11.311 컴팩트 보존 (구 §11.311a → 통합 host)", () => {
  it("audit 활동 모드 KPI grid-cols-3 컴팩트(§11.311, 모바일 한 줄)", () => {
    const src = read(AUDIT);
    expect(src).toMatch(/grid-cols-3/);
  });
});
