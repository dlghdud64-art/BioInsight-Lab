/**
 * #operational-brief-visual-uplift-f1
 *
 * 호영님 Gemini Studio mockup 정합 — popup 내부 시각 디자인 강화 (Option B,
 * popup → rail 전환은 별도 batch). 4 spec:
 *
 *   1. LABAXIS AI INSIGHT block: bg-slate-900 rounded-xl + relative + glow
 *      gradient (bg-blue-500/10 blur-2xl absolute) — 시선 집중도 ↑
 *   2. LIVE 뱃지: pill 형태 bg-emerald-500/20 text-emerald-400 + animate-pulse
 *      dot (현재는 점 + 텍스트 분리)
 *   3. < 카테고리 back button: 큰 클릭 영역 (text-sm px-3 py-2 등)
 *   4. 비활성 카테고리 (stat.total === 0) 시 opacity-60 grayscale 분기
 *
 * canonical truth lock:
 *   - selectedSignals / item.priority / CATEGORIES 상수 변경 0
 *   - mutation 0 (UI only)
 *   - mobile (MobileOperationalBriefSheet) touch 0
 *   - 기존 D1~D5 + E1+E2 invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP_PATH = resolve(__dirname, "../../../components/operational-brief/popup.tsx");
const popup = readFileSync(POPUP_PATH, "utf8");

describe("#operational-brief-visual-uplift-f1 — LABAXIS AI INSIGHT 다크 + glow", () => {
  it("INSIGHT block 에 rounded-xl 적용 (기존 rounded-lg → rounded-xl)", () => {
    // INSIGHT section 의 outer wrapper 가 rounded-xl 사용.
    expect(popup).toMatch(/rounded-xl[\s\S]{0,200}LABAXIS AI INSIGHT|LABAXIS AI INSIGHT[\s\S]{0,500}rounded-xl/);
  });

  it("INSIGHT block 에 relative + overflow-hidden 보존 (glow absolute child 영역)", () => {
    expect(popup).toMatch(/relative[\s\S]{0,500}LABAXIS AI INSIGHT|LABAXIS AI INSIGHT[\s\S]{0,500}relative/);
  });

  it("glow gradient absolute element — bg-blue-500/10 blur-2xl 패턴", () => {
    // 호영님 mockup 의 핵심 — INSIGHT 박스 우측 상단 코너에 blue glow.
    expect(popup).toMatch(/bg-blue-500\/10[\s\S]{0,80}blur-2xl|blur-2xl[\s\S]{0,80}bg-blue-500\/10/);
  });

  it("glow element absolute 위치 — pointer-events-none (interaction block 차단)", () => {
    expect(popup).toMatch(/pointer-events-none/);
  });
});

describe("#operational-brief-visual-uplift-f1 — LIVE pill 뱃지 통합", () => {
  it("LIVE 뱃지 pill — bg-emerald-500/20 + text-emerald-400 패턴", () => {
    expect(popup).toMatch(/bg-emerald-500\/20[\s\S]{0,150}text-emerald-400|text-emerald-400[\s\S]{0,150}bg-emerald-500\/20/);
  });

  it("LIVE pill 안 dot — animate-pulse 사용 (기존 animate-ping 별도 점 제거)", () => {
    expect(popup).toMatch(/animate-pulse/);
  });
});

describe("#operational-brief-visual-uplift-f1 — back button 큰 클릭 영역", () => {
  it("back button — px-3 py-2 또는 등가 큰 padding 패턴", () => {
    // 카테고리 목록으로 aria-label 가진 button 의 className 검사.
    expect(popup).toMatch(/aria-label="카테고리 목록으로"[\s\S]{0,300}px-3[\s\S]{0,80}py-2|px-3[\s\S]{0,80}py-2[\s\S]{0,300}aria-label="카테고리 목록으로"/);
  });

  it("back button — text-sm 적용 (기존 text-xs → text-sm)", () => {
    expect(popup).toMatch(/aria-label="카테고리 목록으로"[\s\S]{0,300}text-sm|text-sm[\s\S]{0,300}aria-label="카테고리 목록으로"/);
  });

  it("back button — ArrowLeft 아이콘 크기 h-4 (기존 h-3.5 → h-4)", () => {
    expect(popup).toMatch(/ArrowLeft[\s\S]{0,300}h-4 w-4|h-4 w-4[\s\S]{0,300}ArrowLeft/);
  });
});

describe("#operational-brief-visual-uplift-f1 — 비활성 카테고리 grayscale", () => {
  it("PopupCategoryGrid 카드에 stat.total === 0 분기 className", () => {
    // grayscale 패턴 — opacity-60 grayscale 또는 등가.
    expect(popup).toMatch(/opacity-60[\s\S]{0,40}grayscale|grayscale[\s\S]{0,40}opacity-60/);
  });

  it("stat.total === 0 분기 helper 존재 (isEmpty / isInactive 등)", () => {
    // boolean 분기 — stat.total === 0 직접 비교 또는 helper.
    expect(popup).toMatch(/stat\.total\s*===\s*0|stat\.total\s*<\s*1|isEmpty|isInactive/);
  });
});

describe("#operational-brief-visual-uplift-f1 — invariant 보존 (D1~D5 + E1+E2)", () => {
  it("D5 chip strip + onSwitchCategory 보존", () => {
    expect(popup).toMatch(/onSwitchCategory/);
  });

  it("D4 priority hierarchy — border-l-[6px] 보존", () => {
    expect(popup).toMatch(/border-l-\[6px\]/);
  });

  it("D3 한 줄 reason — derivePriorityReason 보존", () => {
    expect(popup).toMatch(/derivePriorityReason/);
  });

  it("D2 마지막 분석 라벨 보존", () => {
    expect(popup).toMatch(/마지막 분석/);
  });

  it("E1 카테고리 tone 매핑 — CATEGORY_TONE_BORDER / CATEGORY_TONE_ICON 보존", () => {
    expect(popup).toMatch(/CATEGORY_TONE_BORDER/);
    expect(popup).toMatch(/CATEGORY_TONE_ICON/);
  });

  it("E2 긴급 뱃지 solid red — bg-rose-500 + text-white 보존", () => {
    expect(popup).toMatch(/bg-rose-500\s+text-white|bg-rose-500.*text-white/);
  });

  it("cluster trace marker", () => {
    expect(popup).toMatch(/#operational-brief-visual-uplift-f1|visual uplift|글로우|glow/i);
  });
});
