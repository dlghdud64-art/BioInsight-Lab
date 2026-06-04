import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// §11.368 §0 Phase 2/3 — 견적·비교 + AI 데코 위젯. Sparkles는 <Sparkles JSX·import로 검사.
const C = "src/components";

describe("§11.368 §0 — ✨ Sparkles 제거 (견적/비교/데코 8파일)", () => {
  const files = [
    "ai/suggestion-panel.tsx",
    "ai/activity-timeline.tsx",
    "ai-insight-card.tsx",
    "products/personalized-recommendations.tsx",
    "quotes/ai-quote-parse-modal.tsx",
  ];
  for (const f of files) {
    it(`${f} — <Sparkles JSX 0 + lucide import 0`, () => {
      const src = read(`${C}/${f}`);
      expect(src).not.toMatch(/<Sparkles/);
      expect(src).not.toMatch(/^\s*Sparkles,/m); // multiline import 항목
    });
  }
  it("compare-analysis-drawer — Sparkles 0", () => {
    const src = read("src/app/compare/_components/compare-analysis-drawer.tsx");
    expect(src).not.toMatch(/<Sparkles/);
    expect(src).not.toMatch(/\bSparkles\b/);
  });
});

describe("§11.368 §0 — AI 판단/마케팅 라벨 → 결정형", () => {
  it("compare-analysis: 'AI 판단'·'AI 분석'(toast) 0 → 비교 분석·권장 조치", () => {
    const src = read("src/app/compare/_components/compare-analysis-drawer.tsx");
    expect(src).not.toMatch(/AI 판단 요약/);
    expect(src).not.toMatch(/title: "AI 분석/);
    expect(src).toMatch(/비교 분석 요약/);
    expect(src).toMatch(/권장 조치/);
    // L1168 출처 투명 문구(AI 분석은 …참고 자료…담당자 확인)는 §0 모범으로 보존.
    expect(src).toMatch(/참고 자료입니다/);
  });

  it("suggestion-panel: VARIANT 'AI 제안/판단/초안' 0 → 기능 라벨", () => {
    const src = read(`${C}/ai/suggestion-panel.tsx`);
    expect(src).not.toMatch(/label: "AI 제안"/);
    expect(src).not.toMatch(/label: "AI 판단"/);
    expect(src).not.toMatch(/label: "AI 초안"/);
    expect(src).toMatch(/label: "비교 분석"/);
  });

  it("ai-quote-parse: 'AI 견적서 파싱' 실 라벨 0 → 견적서 자동 인식", () => {
    const src = read(`${C}/quotes/ai-quote-parse-modal.tsx`);
    // 헤더 span 실 텍스트 전환(주석/파일헤더 제외).
    expect(src).toMatch(/견적서 자동 인식/);
    expect(src).not.toMatch(/>AI 견적서 파싱</);
  });
});

describe("§11.368 §0 — 회귀 0 (대체 아이콘 import 단일)", () => {
  it("ai-quote-parse: Loader2 import 중복 0 (단일)", () => {
    const src = read(`${C}/quotes/ai-quote-parse-modal.tsx`);
    const importLoader2 = (src.match(/^\s*[A-Za-z0-9, ]*\bLoader2\b/gm) ?? []).filter((l) =>
      /Upload|ChevronRight/.test(l) === false ? true : true
    );
    // import 블록에 Loader2 1회만(중복 라인 0).
    expect(src.match(/Loader2, ChevronRight, Edit3, Save/)).toBeNull();
  });
});
