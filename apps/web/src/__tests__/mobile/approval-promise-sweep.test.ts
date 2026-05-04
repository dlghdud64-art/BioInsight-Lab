/**
 * §11.209b mobile #approval-promise-sweep — RED test
 *
 * mobile (Expo/RN) surface 의 결재 약속 dead promise 잔존 0 강제.
 * future drift 차단 lock — mobile 카피가 web 의 §11.209 헤더 약속 같은
 * "결재가 필요한 항목은 자동으로..." 패턴 도입 방지.
 *
 * canonical truth (§11.209b cluster):
 *   - web: workspace.plan → resolveApprovalPolicyForPlan → 헤더 카피
 *     Tier 분기 (Lab Team='none' 시 약속 카피 제거)
 *   - mobile: 결재 약속 카피 자체를 보유 0 — 모바일은 현장/엣지 운영
 *     도구로 위치 (dashboard "승인 대기" counter 는 데이터 기반 정합)
 *
 * 본 test 가 fail 하면 mobile 에 dead promise 도입 위험 — §11.209c 후속
 * batch 와 함께 mobile workspace.plan 분기 wiring 필요.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const MOBILE_APP = "apps/mobile/app";
const MOBILE_LIB = "apps/mobile/lib";

/** Recursively collect .ts/.tsx file content. */
function collectMobileSources(dir: string): { rel: string; content: string }[] {
  const abs = join(REPO_ROOT, dir);
  const out: { rel: string; content: string }[] = [];
  function walk(d: string, baseRel: string) {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      // skip hidden / node_modules / fuse mounts
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(d, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      const rel = baseRel ? `${baseRel}/${entry}` : entry;
      if (st.isDirectory()) {
        walk(full, rel);
      } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
        try {
          out.push({ rel, content: readFileSync(full, "utf8") });
        } catch {
          /* skip */
        }
      }
    }
  }
  walk(abs, "");
  return out;
}

describe("§11.209b mobile — dead promise 카피 잔존 0", () => {
  const mobileApp = collectMobileSources(MOBILE_APP);
  const mobileLib = collectMobileSources(MOBILE_LIB);
  const allMobile = [...mobileApp, ...mobileLib];

  it("mobile codebase 에 '결재가 필요한 항목' 약속 패턴 0 (web 의 §11.209 헤더 카피와 동일 패턴 차단)", () => {
    const matches: string[] = [];
    for (const file of allMobile) {
      if (/결재가\s*필요한\s*항목/.test(file.content)) {
        matches.push(file.rel);
      }
    }
    expect(matches).toEqual([]);
  });

  it("mobile codebase 에 '결재 라인에 자동' 약속 패턴 0", () => {
    const matches: string[] = [];
    for (const file of allMobile) {
      if (/결재\s*라인에\s*자동|자동으로\s*결재\s*라인/.test(file.content)) {
        matches.push(file.rel);
      }
    }
    expect(matches).toEqual([]);
  });

  it("mobile codebase 에 'in_app_light' / 'external_manual' drift 어휘 잔존 0 (§11.99 정합)", () => {
    const matches: string[] = [];
    for (const file of allMobile) {
      if (/"in_app_light"|"external_manual"/.test(file.content)) {
        matches.push(file.rel);
      }
    }
    expect(matches).toEqual([]);
  });

  it("mobile (tabs)/purchases.tsx 에 결재/승인 약속 카피 0", () => {
    const file = mobileApp.find((f) => f.rel === "(tabs)/purchases.tsx");
    expect(file).toBeDefined();
    if (file) {
      expect(file.content).not.toMatch(/결재|승인 라인/);
    }
  });

  it("mobile (tabs)/quotes.tsx 에 결재 약속 카피 0", () => {
    const file = mobileApp.find((f) => f.rel === "(tabs)/quotes.tsx");
    expect(file).toBeDefined();
    if (file) {
      expect(file.content).not.toMatch(/결재가\s*필요|결재\s*라인/);
    }
  });
});

describe("§11.209b mobile — '승인 대기' counter 는 데이터 기반 정합 (dead promise 아님)", () => {
  const mobileApp = collectMobileSources(MOBILE_APP);

  it("mobile (tabs)/index.tsx 의 '승인 대기' 는 데이터 (pendingQuotes count) 기반", () => {
    const file = mobileApp.find((f) => f.rel === "(tabs)/index.tsx");
    expect(file).toBeDefined();
    if (file) {
      // "승인 대기" 라벨이 approvalPending 변수 또는 pendingQuotes 와 함께 사용
      // (즉 데이터 기반 — count > 0 시 visible)
      expect(file.content).toMatch(/approvalPending|pendingQuotes/);
      // 약속 카피 ("결재가 필요한 항목은 자동으로...") 패턴 잔존 0
      expect(file.content).not.toMatch(/결재가\s*필요한\s*항목/);
    }
  });
});
