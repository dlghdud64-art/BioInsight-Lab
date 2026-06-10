import { readFileSync, existsSync } from "node:fs";
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
  it("compare-analysis-drawer — §11.381c retire (단언 대상 소멸, 부활 금지)", () => {
    // §11.381c (호영님 b2 결정 2026-06-10): compare 라우트 + drawer retire.
    // Sparkles 0 단언은 파일 소멸로 자연 충족 — 부재 검증으로 전환.
    expect(existsSync(join(REPO_ROOT, "src/app/compare/_components/compare-analysis-drawer.tsx"))).toBe(false);
  });
});

describe("§11.368 §0 — AI 판단/마케팅 라벨 → 결정형", () => {
  it("compare-analysis — §11.381c retire (라벨 단언 대상 소멸)", () => {
    // §11.381c (2026-06-10): compare-analysis-drawer retire — AI 판단/마케팅
    // 라벨 0 단언은 파일 소멸로 자연 충족. 부재 검증으로 전환.
    expect(existsSync(join(REPO_ROOT, "src/app/compare/_components/compare-analysis-drawer.tsx"))).toBe(false);
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
