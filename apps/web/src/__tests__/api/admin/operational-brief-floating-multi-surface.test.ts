/**
 * §11.176 #operational-brief-floating-entry-multi-surface
 *
 * shared parts 추출 (MetricCell + formatRelativeKr) + 4 surface 의 floating
 * entry mount 검증.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.176 shared brief parts 추출", () => {
  it("MetricCell 컴포넌트 파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, "src/components/operational-brief/metric-cell.tsx"))).toBe(true);
  });

  it("MetricCell text-3xl 수치 + tone 별 액센트", () => {
    const src = read("src/components/operational-brief/metric-cell.tsx");
    expect(src).toMatch(/text-3xl/);
    expect(src).toMatch(/border-l-emerald-500/);
    // §quotes-brief-suppress 재앵커(호영님 2026-07-02) — MetricCell warn 톤 소스 truth = border-l-yellow-500.
    //   선재 stale(테스트 amber-500 잔존) 완결. ⚠ §11.302(주의색=amber #b45821)와 정합 원하면 소스
    //   metric-cell.tsx warn 을 amber 로 바꾸는 별건 필요(디자인 정책 검토).
    expect(src).toMatch(/border-l-yellow-500/);
    expect(src).toMatch(/border-l-red-500/);
    expect(src).toMatch(/border-l-slate-300/);
    expect(src).toMatch(/export\s+function\s+MetricCell/);
  });

  it("formatRelativeKr util 파일 존재 + 한국어 케이스", () => {
    const path = "src/components/operational-brief/relative-time.ts";
    expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    const src = read(path);
    expect(src).toMatch(/방금 전/);
    expect(src).toMatch(/분 전/);
    expect(src).toMatch(/시간 전/);
    expect(src).toMatch(/일 전/);
    expect(src).toMatch(/export\s+function\s+formatRelativeKr/);
  });

  it("inbox 가 shared MetricCell + formatRelativeKr import 로 마이그레이션", () => {
    const src = read("src/app/dashboard/inbox/page.tsx");
    expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/metric-cell["']/);
    expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/relative-time["']/);
    // local 정의 잔존 0 (실제 함수 정의가 사라졌는지 확인 — comment 무시)
    expect(src).not.toMatch(/^function\s+MetricCell\s*\(/m);
    expect(src).not.toMatch(/^function\s+formatRelativeKr\s*\(/m);
  });
});

// §quotes-brief-suppress (호영님 2026-07-02) — 견적(quotes) surface 는 운영 브리핑 FAB 제거 →
//   §11.176 4-surface 불변식에서 quotes 제외(3 surface). "공급사 발송 검토" 모달이 정식 워크플로.
//   quotes 억제 앵커는 별도 sentinel(quotes-brief-suppress.test.ts) 소유.
describe("§11.176 floating entry mount (§quotes-brief-suppress: quotes 제외 3 surface)", () => {
  const SURFACES: { name: string; path: string }[] = [
    { name: "inbox", path: "src/app/dashboard/inbox/page.tsx" },
    { name: "dashboard", path: "src/app/dashboard/page.tsx" },
    { name: "purchases", path: "src/app/dashboard/purchases/page.tsx" },
  ];

  for (const { name, path } of SURFACES) {
    it(`${name} surface 가 OperationalBriefFloatingEntry import + 사용`, () => {
      const src = read(path);
      expect(src).toMatch(/OperationalBriefFloatingEntry/);
      expect(src).toMatch(/from\s+["']@\/components\/operational-brief\/floating-entry["']/);
    });
  }
});

describe("§11.176 surface 별 hydrate handler (§11.181 popup default 로 marshall 됨)", () => {
  it("§11.181 — purchases FAB 에 onClick prop 없음 (popup context 사용)", () => {
    const src = read("src/app/dashboard/purchases/page.tsx");
    const m = src.match(/<OperationalBriefFloatingEntry[\s\S]*?\/>/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/\bonClick\s*=/);
  });
});
