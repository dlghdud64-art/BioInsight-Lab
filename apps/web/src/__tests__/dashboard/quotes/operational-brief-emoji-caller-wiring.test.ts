// 🛑 은퇴 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 견적 관리 브리핑 레일(우측 4탭)·모바일 맥락 시트·모바일 브리핑 시트 삭제.
//   이 파일의 견적 레일 전용 단언 3건을 it.skip 으로 은퇴했다. 원 명제는 각 it 제목에 그대로 남아 있다.
//   살아 있는 명제(표면 0 · 행 클릭 = 선택만 · 대체 진입점)는 regression/quote-brief-rail-removed.test.ts 로 이관했다.
/**
 * #operational-brief-emoji-sweep — Phase 1 RED (caller wiring)
 *
 * quotes/page.tsx 의 desktop §11.221 + mobile §11.222 inline IIFE 가 새
 * structured helper (buildBriefRationale) 호출하여 case + tone 따라
 * Lucide icon + 컬러 도트 표시.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#operational-brief-emoji-sweep — quotes/page.tsx caller", () => {
  it.skip("새 structured helper buildBriefRationale import", () => {
    expect(page).toMatch(/buildBriefRationale[^A-Za-z]/);
  });

  it.skip("desktop + mobile 두 곳 buildBriefRationale 호출", () => {
    const matches = page.match(/buildBriefRationale\s*\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("page.tsx 자체에 emoji prefix 잔존하지 않음 (cluster sentinel)", () => {
    // 기존 inline IIFE 의 message rendering 이 emoji 안 포함하므로 page.tsx 본문도 emoji 0.
    // (단 코멘트 안의 emoji 는 무시 — line by line 검증.)
    const lines = page.split("\n");
    const visibleEmojiLine = lines.find((line, i) => {
      // 코멘트 라인 (// 또는 /* 시작) 제외.
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return false;
      return /[📋📤📥📊✅⚠️⏰]/.test(line);
    });
    expect(visibleEmojiLine, `emoji 잔존 line: ${visibleEmojiLine}`).toBeFalsy();
  });

  it("Lucide icon 매핑 import (Send/Inbox/CheckCircle2/등)", () => {
    // 6 case tone 별 아이콘 매핑 — Send (not_sent/awaiting_reply), Inbox (partial_reply),
    // CheckCircle2 (reply_complete/po_ready), AlertTriangle (fallback red), Clock (inventory tail).
    expect(page).toMatch(/Send|Inbox|CheckCircle2|AlertTriangle|Clock/);
  });

  it.skip("cluster trace marker", () => {
    expect(page).toMatch(/#operational-brief-emoji-sweep|이모지 제거|emoji-sweep|B2B 톤/);
  });
});
