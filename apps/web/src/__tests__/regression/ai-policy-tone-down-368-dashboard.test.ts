import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

// §11.368 §0 Phase 1 — 대시보드 운영 위젯 AI 마케팅 톤 → 결정형.
// Sparkles는 JSX(<Sparkles)·import 라인으로 검사(작업 설명 주석의 단어는 무관).
const D = "src/components/dashboard";

describe("§11.368 §0 — ✨ Sparkles 데코 제거 (JSX + import)", () => {
  const files = [
    "ai-insight-dialog.tsx",
    "smart-pick-widget.tsx",
    "analytics-dashboard.tsx",
    "command-palette.tsx",
  ];
  for (const f of files) {
    it(`${f} — <Sparkles JSX 0 + lucide import 0`, () => {
      const src = read(`${D}/${f}`);
      expect(src).not.toMatch(/<Sparkles/);
      expect(src).not.toMatch(/import \{[^}]*\bSparkles\b[^}]*\} from "lucide-react"/);
    });
  }
});

describe("§11.368 §0 — AI 마케팅 라벨 → 결정형", () => {
  it("ai-insight-dialog: AI 리포트 생성/AI 운영 인사이트 0 → 운영 리포트 + 조치 후보", () => {
    const src = read(`${D}/ai-insight-dialog.tsx`);
    expect(src).not.toMatch(/AI 리포트 생성/);
    expect(src).not.toMatch(/AI 운영 인사이트/);
    expect(src).toMatch(/운영 리포트/);
    expect(src).toMatch(/조치 후보/); // 권고(AI 결정) → 후보(operator review 종착)
  });

  it("smart-pick: 'AI 추천' 0 → 재주문 검토 권장 (의인화 제거)", () => {
    const src = read(`${D}/smart-pick-widget.tsx`);
    expect(src).not.toMatch(/AI 추천/);
    expect(src).not.toMatch(/챙겨봤어요/);
    expect(src).toMatch(/재주문 검토 권장/);
  });

  it("analytics: '스마트 인사이트' 0 → 데이터 분석 요약", () => {
    const src = read(`${D}/analytics-dashboard.tsx`);
    expect(src).not.toMatch(/스마트 인사이트/);
    expect(src).toMatch(/데이터 분석 요약/);
  });

  it("command-palette: 'AI 자연어 분석' 0 → 자연어 검색", () => {
    const src = read(`${D}/command-palette.tsx`);
    expect(src).not.toMatch(/AI 자연어 분석/);
    expect(src).toMatch(/자연어 검색/);
  });
});

describe("§11.368 §0 — 회귀 0 (AI 기능 보존, 마케팅 톤만 절제)", () => {
  it("ai-insight-dialog: 분석 API 호출 보존(기능 유지)", () => {
    const src = read(`${D}/ai-insight-dialog.tsx`);
    expect(src).toMatch(/\/api\/analytics\/ai-insight/);
  });

  it("AI 마케팅 gradient 데코 제거", () => {
    expect(read(`${D}/ai-insight-dialog.tsx`)).not.toMatch(/from-indigo-500 to-purple-500/);
    expect(read(`${D}/smart-pick-widget.tsx`)).not.toMatch(/gradient-to-br from-blue-50 to-indigo-50/);
    expect(read(`${D}/analytics-dashboard.tsx`)).not.toMatch(/gradient-to-br from-blue-50 to-indigo-50/);
  });
});
