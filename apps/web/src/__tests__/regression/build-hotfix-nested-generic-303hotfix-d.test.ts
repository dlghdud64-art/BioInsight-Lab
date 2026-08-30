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
    /* 승계 (§org-management-web P4a 2026-08-24 · 공백만 완화):
     * 옛 정규식은 `push({ label:` 를 **같은 줄**로 요구했다. P4a 가 항목에
     * consequence 를 더하며 여는 중괄호 뒤에서 줄바꿈했을 뿐, 이 sentinel 이
     * 잠그는 결정(SWC nested-generic 회피 · 두 항목 존재)은 무손상이다.
     * → 중괄호와 label 사이 공백/개행만 허용한다. 항목 라벨 2개는 그대로 핀. */
    expect(SRC).toMatch(
      /actionableItems\.push\(\{\s*label:\s*"초대 응답 대기"/,
    );
    /* 🔑 **승계 되돌림** (호영님 명시 승인 2026-08-30) —
     *   "(다) 근거 소멸 — (나)-1b 가 승인 경로를 열었고 3단 실측(3569ede8)으로 도달 확인"
     *
     * 2026-08-26 (다)가 "승인자 미지정" 항목을 은퇴시키며 이 파일에 **부재 단언 한 줄**을
     * 승계 조항으로 붙였다. ①c 가 조건부로 되살아났으므로 그 한 줄만 되돌린다.
     * 🛑 이 sentinel 의 **원 결정(SWC nested-generic 회피 · push 사용처 보존)은 무손상**
     *   이다 — 성격이 다른 조항이 얹혀 있었을 뿐이고, 항목 개수는 원래 잠금 대상이 아니다.
     *   발화 조건과 문구는 organizations-approver-alarm-retired 가 소유한다.
     *   여기서 다시 핀하지 않는다(같은 사실을 두 곳이 말하면 다음 갈라짐의 씨앗). */
    expect(SRC).toMatch(
      /actionableItems\.push\(\{\s*\n?\s*label:\s*"승인자 미지정"/,
    );
  });

  it("JSX return 구조 보존 (line ~477) — return ( 다음이 space-y-6 루트 div", () => {
    /* 승계 (§org-management-web P6 2026-08-25 · 표현만 완화):
     * 이 단언이 잠그는 결정은 "SWC nested-generic 회피 후 JSX return 구조가 살아있다" 이지
     * className 문자열이 아니다. P6 가 §dashboard-padding-unify 누락분(좌우 여백 0)을
     * 봉합하며 같은 div 에 패딩 래퍼를 얹고 근거 주석을 넣었을 뿐, 구조는 무손상이다.
     * → return ( 과 <div 사이 주석 1개를 허용하고, className 은 space-y-6 포함으로 핀한다.
     *   주석 본문은 부정 선읽기로 첫 닫힘에서 끊어 창을 넘지 못하게 한다. */
    expect(SRC).toMatch(/return \(\n(?:\s*\/\*(?:(?!\*\/)[\s\S])*?\*\/\n)?\s*<div className="[^"\n]*\bspace-y-6\b[^"\n]*">\n/);
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
