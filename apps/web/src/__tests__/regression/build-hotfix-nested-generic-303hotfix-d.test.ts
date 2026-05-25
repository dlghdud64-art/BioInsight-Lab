/**
 * §11.303-hotfix-d #build-hotfix-nested-generic — organizations/[id]/page.tsx
 *   line 473 nested TypeScript generic SWC parser bug 회피.
 *
 * 🚨 Critical (§11.303-hotfix 후속):
 * CRLF → LF 변환 (§11.303-hotfix) 후에도 동일 build ERROR 지속.
 * 새 Vercel deployment (dpl_29MH4fiWeuk3CekR614Gnk9TAKbN, sha 79780f1)
 * 의 build log:
 *   line 475/476/477/478/479/480/481 sequential (CRLF 변환 확인됨)
 *   여전히 "Unexpected token `div`. Expected jsx identifier" at line 478
 *
 * Root cause:
 * line 473 의 nested TypeScript generic 이 SWC parser 의 JSX context
 * detection 을 방해:
 *   Array<{ ... icon: React.ComponentType<{ className?: string }>; ... }>
 *                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *                              nested generic <{ }> 의 `<` 가 JSX 시작으로 잘못 parse
 *
 * SWC parser 가 nested `<>` 후 다음 라인의 `<div` 를 generic 의 일부로
 * 받아들임 → JSX identifier expected 으로 fail.
 *
 * Fix:
 *   Array<{ ... React.ComponentType<{ className?: string }> ... }>
 *   → { ... React.ElementType ... }[]
 *
 * 1. React.ElementType — React.ComponentType<any> | string 의 union,
 *    nested generic 0
 * 2. postfix `[]` — Array<> generic wrapper 제거 (nesting depth 감소)
 *
 * settings/workspace/page.tsx 도 동일 build log fail 표시했으나 source
 * 에는 nested generic 부재 — organizations cascade error 추정. 본 batch
 * 으로 organizations 만 fix 후 settings/workspace 자동 통과 가능성.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/app/dashboard/organizations/[id]/page.tsx"),
  "utf8",
);

describe("§11.303-hotfix-d — nested generic SWC parser bug 회피", () => {
  it("§11.303-hotfix-d trace marker", () => {
    expect(SRC).toMatch(/§11\.303-hotfix-d/);
  });

  it("actionableItems type — nested generic Array<...React.ComponentType<...>...> 제거", () => {
    // 이전 fail 패턴 부재
    expect(SRC).not.toMatch(
      /const actionableItems:\s*Array<\{[^}]*React\.ComponentType<\{[^}]*\}>[^}]*\}>/,
    );
  });

  it("actionableItems type — React.ElementType 단일 token + postfix [] 사용", () => {
    expect(SRC).toMatch(
      /const actionableItems:\s*\{[\s\S]*?icon:\s*React\.ElementType[\s\S]*?\}\[\]\s*=\s*\[\]/,
    );
  });

  it("actionableItems 사용처 보존 — push label/count/icon/color", () => {
    expect(SRC).toMatch(
      /actionableItems\.push\(\{ label:\s*"초대 응답 대기"/,
    );
    expect(SRC).toMatch(
      /actionableItems\.push\(\{ label:\s*"승인자 미지정"/,
    );
  });

  it("JSX return 구조 보존 (line ~477) — return ( <div className=\"space-y-6\">", () => {
    expect(SRC).toMatch(/return \(\s*\n\s*<div className="space-y-6">/);
    expect(SRC).toMatch(/\{\/\* 헤더 \*\/\}/);
  });

  it("§11.298c ActionMenu shared swap 보존 (회귀 0)", () => {
    expect(SRC).toMatch(/§11\.298c/);
    expect(SRC).toMatch(/<ActionMenu/);
    expect(SRC).toMatch(/openMemberActionId/);
  });

  it("§11.303-hotfix (CRLF → LF) 보존 — CRLF 0", () => {
    const buf = readFileSync(
      resolve(
        REPO_ROOT,
        "apps/web/src/app/dashboard/organizations/[id]/page.tsx",
      ),
    );
    let crlfCount = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0d) crlfCount++;
    }
    expect(crlfCount).toBe(0);
  });
});
