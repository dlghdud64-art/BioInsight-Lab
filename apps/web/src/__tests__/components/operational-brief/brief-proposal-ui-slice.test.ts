/**
 * §brief-proposal-ui — 운영 브리핑 제안형 UI-safe 슬라이스 (호영님 2026-06-29)
 *
 * 제안형 핸드오프 중 **정직하게 가능한 view-state 신뢰루프만** 구현:
 *   - 넘기기(dismiss) → "오늘 숨김" 섹션 → 되돌리기 (순수 client view-state, 서버/canonical truth 0 변형)
 *   - idle: 활성 0건 시 정직 안내(4개 모듈 모니터링). ❌ 가짜 "내일 예상" 0
 *   - 사유 라벨: 이미 처리함 / 불필요 / 나중에 (정직). ❌ "AI가 학습합니다"·자동 승인 류 fake claim 0
 *
 * 제외(백엔드 후속): 실 승인 mutation · 신뢰도% 칩 · 자동승인 · 내일 예상 예측 · 구조화 산출물 미리보기.
 *
 * honesty 가드 보존: primaryAction null=nav(router.push) 유지 — placeholder success 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP = readFileSync(
  resolve(__dirname, "../../../components/operational-brief/popup.tsx"),
  "utf8",
);

describe("§brief-proposal-ui — 넘기기(dismiss) view-state", () => {
  it("DismissReason 타입 + 정직 사유 라벨(이미 처리함/불필요/나중에)", () => {
    expect(POPUP).toMatch(/type DismissReason = "done" \| "unnecessary" \| "later"/);
    expect(POPUP).toContain("이미 처리함");
    expect(POPUP).toContain("불필요");
    expect(POPUP).toContain("나중에");
  });

  it("dismissed = client Map state (서버/canonical 변형 0)", () => {
    expect(POPUP).toMatch(/useState<Map<string, DismissReason>>\(new Map\(\)\)/);
    expect(POPUP).toContain("const dismissItem");
    expect(POPUP).toContain("const restoreItem");
  });

  it("popup close 시 숨김 초기화(영속 없음 = 정직)", () => {
    expect(POPUP).toContain("setDismissed(new Map());");
  });

  it("넘기기 버튼 + 오늘 숨김 섹션 + 되돌리기", () => {
    expect(POPUP).toContain("넘기기");
    expect(POPUP).toContain("오늘 숨김");
    expect(POPUP).toContain("되돌리기");
    expect(POPUP).toMatch(/onRestore\(it\.id\)/);
  });

  it("recalc — moduleCounts/visibleItems 가 숨김 제외", () => {
    expect(POPUP).toMatch(/if \(dismissed\.has\(it\.id\)\) continue;/);
    expect(POPUP).toMatch(/sortedItems\.filter\(\(i\) => !dismissed\.has\(i\.id\)\)/);
  });
});

describe("§brief-proposal-ui — idle 정직", () => {
  it("활성 0건 idle: 4개 모듈 모니터링 (가짜 내일 예상 0)", () => {
    expect(POPUP).toContain("4개 모듈을 모니터링");
    expect(POPUP).not.toContain("내일");
  });
});

describe("§brief-proposal-ui — honesty 가드 (fake claim 0)", () => {
  it("가짜 진척 주장(학습/자동 승인) 0", () => {
    expect(POPUP).not.toContain("학습");
    expect(POPUP).not.toContain("자동 승인");
    expect(POPUP).not.toContain("자동승인");
  });

  it("가짜 신뢰도% 칩 0 (data-conf / 신뢰 N% 부재)", () => {
    expect(POPUP).not.toContain("data-conf");
    expect(POPUP).not.toMatch(/신뢰\s*\d/);
  });

  it("승인 = nav(router.push) honesty 가드 보존 — placeholder success 0", () => {
    expect(POPUP).toMatch(/brief\.primaryAction &&/);
    expect(POPUP).toMatch(/router\.push\(brief\.goHref\)/);
  });
});

describe("§brief-proposal-ui — 보존(회귀 0)", () => {
  it("단일 큐 2섹션(지금 처리 / 검토 대기) 보존", () => {
    expect(POPUP).toContain("지금 처리");
    expect(POPUP).toContain("검토 대기");
  });
  it("a11y aria-expanded + 헤더 폭(400/460/432) 보존", () => {
    expect(POPUP).toContain("aria-expanded={expanded}");
    expect(POPUP).toContain("md:w-[400px]");
    expect(POPUP).toContain("xl:w-[460px]");
    expect(POPUP).toContain("2xl:w-[432px]");
  });
  it("LIVE 인디케이터 부재 유지(Real-time Operations / bg-emerald-400 0)", () => {
    expect(POPUP).not.toContain("Real-time Operations");
    expect(POPUP).not.toContain("bg-emerald-400");
  });
});
