/**
 * §self-shell-zero (호영님 판정 2026-09-07) —
 * **`/dashboard` 밖 화면도 셸을 손으로 짓지 않는다. `DashboardShell` 을 쓴다.**
 *
 * 왜 이 sentinel 이 있는가 — 자체 셸에서 나온 결함이 넷이다(전부 같은 뿌리):
 *   §sidebar-spacer        사이드바 spacer 를 화면이 또 밀어 512px 두 번 밀림
 *   §dashboard-header-swap 마케팅 헤더(`fixed h-14`)를 대시보드 화면이 렌더 → 제목 가림
 *   §global-modal-root     모달 렌더러가 화면마다 따로 → store 하나에 모달 둘
 *   2026-09-07 헤더 이동    헤더를 스크롤 컨테이너 **안**으로 옮기자 `sticky` 가 풀림
 *     (그 컨테이너의 조상이 `min-h-screen` 이라 스크롤이 거기서 일어나지 않는다.
 *      `DashboardShell` 은 헤더가 스크롤러의 **형제**라 같은 문제가 성립하지 않는다.)
 *
 * 🔑 잠그는 것은 **명제**다 — "셸을 복제하지 않는다".
 *    구조를 베끼면 다섯 번째가 나온다(BottomNav 가 그 자리였다). 컴포넌트를 참조한다.
 *
 * ⚠️ 이 파일은 §page-shell-single-source(셸을 **둘** 렌더하지 않는다)와 축이 다르다.
 *    거기는 마케팅 × 대시보드 **혼용** 금지, 여기는 대시보드 셸 **자작** 금지다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

/** 자체 셸을 버리고 `DashboardShell` 로 간 화면 (호영님 2026-09-07 판정 · 소유권 이관). */
const WRAPPED = [
  "src/app/admin/requests/page.tsx",
  "src/app/admin/safety/page.tsx",
  "src/app/billing/page.tsx",
  "src/app/settings/audit/page.tsx",
  "src/app/settings/billing/page.tsx",
  "src/app/settings/security/page.tsx",
  "src/app/settings/workspace/page.tsx",
  "src/app/team/settings/page.tsx",
] as const;

const SHELL = "src/app/dashboard/_components/dashboard-shell.tsx";

/**
 * `<DashboardShell>` … `</DashboardShell>` 블록의 **문자 구간**을 돌려준다.
 *
 * 🛑 고정 폭 슬라이스를 쓰지 않는다(4원칙 ⑤). 블록이 길어지면 뒤 분기가 창 밖으로
 *    밀려 **계약을 지키는 구현이 RED** 가 된다. 여는 태그 ↔ 같은 들여쓰기의 닫는
 *    태그로 연다(이 태그는 중첩되지 않는다 — 아래 `중첩 0` 단언이 그걸 잠근다).
 */
function shellRanges(src: string): Array<[number, number]> {
  const lines = src.split("\n");
  const starts: number[] = [];
  let acc = 0;
  for (const l of lines) {
    starts.push(acc);
    acc += l.length + 1;
  }
  const out: Array<[number, number]> = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== "<DashboardShell>") continue;
    const indent = lines[i].length - lines[i].trimStart().length;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === "</DashboardShell>" && l.length - l.trimStart().length === indent) {
        out.push([starts[i + 1], starts[j]]);
        i = j;
        break;
      }
    }
  }
  return out;
}

/**
 * 이 문구가 **모든 출현 지점에서** 셸 안인가.
 *
 * 🛑 "한 곳이라도 셸 안이면 통과" 로 쓰면 안 된다(4원칙 ④ 대체 매칭). 실측 2026-09-07:
 *    `로딩 중...` 은 대기 분기 말고 본문 버튼 라벨에도 있어서(security 2곳 · workspace 3곳 ·
 *    team 2곳), 대기 분기를 셸 밖으로 빼는 프로브에 **3파일이 GREEN 으로 통과**했다.
 *    출현 전량을 보면 하나만 밖으로 나가도 RED 다.
 */
function allOccurrencesInsideShell(src: string, needle: string): boolean {
  const ranges = shellRanges(src);
  let at = src.indexOf(needle);
  let seen = 0;
  while (at !== -1) {
    seen += 1;
    if (!ranges.some(([a, b]) => at >= a && at < b)) return false;
    at = src.indexOf(needle, at + needle.length);
  }
  return seen > 0;
}

describe("§self-shell-zero — 축 잠금", () => {
  it("대상 8곳이 실재하고 셸 정본이 하나다 (스코프가 조용히 0이 되지 않게)", () => {
    expect(WRAPPED).toHaveLength(8);
    for (const f of WRAPPED) expect(read(f).length).toBeGreaterThan(0);
    expect(read(SHELL)).toMatch(/export function DashboardShell\(/);
  });
});

describe("§self-shell-zero — 자체 셸 0", () => {
  it.each(WRAPPED)("%s — 셸 부품을 직접 렌더하지 않는다", (f) => {
    const code = stripComments(read(f));
    /* 🛑 부품을 직접 렌더하면 그 순간 이 화면만의 셸이 다시 생긴다.
     *   import 가 아니라 **사용처**(`<Name`)를 본다 — 죽은 import 는 별건이다. */
    expect(code).not.toMatch(/<DashboardSidebar\b/);
    expect(code).not.toMatch(/<DashboardHeader\b/);
    /* `min-h-screen` 은 자체 셸 루트의 표식이었다(8곳 전부 같은 형태였다).
     *   높이 계약은 셸이 `h-screen overflow-hidden` 으로 쥔다. */
    expect(code).not.toMatch(/min-h-screen/);
  });

  it.each(WRAPPED)("%s — `DashboardShell` 을 정본 경로에서 가져와 쓴다", (f) => {
    const src = read(f);
    expect(src).toMatch(
      /import \{ DashboardShell \} from "@\/app\/dashboard\/_components\/dashboard-shell";/,
    );
    const opens = (src.match(/<DashboardShell>/g) ?? []).length;
    const closes = (src.match(/<\/DashboardShell>/g) ?? []).length;
    expect(opens).toBeGreaterThan(0);
    expect(opens).toBe(closes);
    // 블록 파서가 성립하려면 중첩이 없어야 한다 (위 shellRanges 의 전제)
    expect(shellRanges(src)).toHaveLength(opens);
  });
});

describe("§self-shell-zero — 로딩·빈 상태도 셸 안", () => {
  /* 🔴 호영님 지적: "지금은 헤더만 있고 사이드바가 없어서 로딩 중에 사이드바가
   *   사라졌다 나타납니다. 그것도 결함입니다."
   *   → 성공 분기만 감싸면 이 sentinel 은 통과하면서 결함이 남는다. 분기별로 본다.
   *   ⚠️ 분기를 새로 추가하면 여기에 프로브도 추가한다(목록이 곧 커버리지다). */
  const BRANCHES: Array<[string, string[]]> = [
    ["src/app/admin/requests/page.tsx", ["로딩 중..."]],
    ["src/app/admin/safety/page.tsx", ["로딩 중...", "워크스페이스가 없습니다."]],
    /* billing 의 `animate-spin text-muted-foreground` 는 **Suspense fallback** 이라
     * 여기 목록에 없다 — 셸을 넣을 수 없는 자리다(아래 `fallback 에 셸 금지` 참조).
     * 화면 안의 대기 분기(`text-blue-600`)만 이 명제의 대상이다. */
    ["src/app/billing/page.tsx", ["animate-spin text-blue-600"]],
    ["src/app/settings/audit/page.tsx", ["로딩 중...", "워크스페이스가 없습니다."]],
    ["src/app/settings/billing/page.tsx", ["h-8 w-8 animate-spin", "조직을 찾을 수 없습니다."]],
    ["src/app/settings/security/page.tsx", ["로딩 중...", "워크스페이스가 없습니다."]],
    ["src/app/settings/workspace/page.tsx", ["로딩 중...", "워크스페이스가 없습니다."]],
    ["src/app/team/settings/page.tsx", ["로딩 중...", "아직 혼자 연구하시나요?"]],
  ];

  it.each(BRANCHES)("%s — 대기·빈 분기가 셸 밖에서 렌더되지 않는다", (f, needles) => {
    const src = read(f);
    for (const n of needles) {
      // 먼저 그 문구가 파일에 실재하는지 — 없으면 `false` 가 아니라 **프로브 결함**이다
      expect(src, `프로브 문구가 파일에 없다: ${n}`).toContain(n);
      expect(
        allOccurrencesInsideShell(src, n),
        `${n} 이(가) 셸 밖에서 렌더된다`,
      ).toBe(true);
    }
  });
});

describe("§self-shell-zero — Suspense fallback 에는 셸을 넣지 않는다", () => {
  /* 🔴 2026-09-07 실측(`next build`): fallback 을 `<DashboardShell>` 로 감쌌더니
   *   `/admin/requests` · `/billing` · `/team/settings` 3곳이 prerender 에서 죽었다 —
   *   셸이 `useOverlayDeepLink()` → `useSearchParams()` 를 부르는데 fallback 은
   *   Suspense 경계 **밖**이라 Next 14 가 CSR bailout 으로 빌드를 실패시킨다.
   *   🛑 "로딩 분기도 셸 안" 을 여기까지 밀면 빌드가 깨진다. 경계는 여기다.
   *   ⚠️ vitest 는 이걸 못 잡는다(정적 검사). 그래서 이 단언이 대신 선다 —
   *      다음 사람이 "일관성" 으로 되돌리는 것을 빌드 40분 전에 막는다. */
  it.each(WRAPPED)("%s — fallback 루트가 셸이 아니다", (f) => {
    const src = read(f);
    expect(src).not.toMatch(/fallback=\{\s*(?:\/\*[\s\S]*?\*\/\s*)?<DashboardShell>/);
  });

  it("🔑 셸을 쓰는 화면은 Suspense 경계를 가진다 (빌드가 깨지는 형태 0)", () => {
    /* 경계가 없으면 같은 CSR bailout 으로 빌드가 죽는다 —
     * `export const dynamic = "force-dynamic"` 로는 안 막힌다(team/settings 실측). */
    for (const f of WRAPPED) {
      expect(read(f), `${f} 에 Suspense 경계가 없다`).toMatch(/<Suspense[\s>]/);
    }
  });
});

describe("§self-shell-zero — 셸 계약 (8곳이 이걸 믿고 자기 구조를 버렸다)", () => {
  it("🔑 헤더가 스크롤러의 **형제**다 (안으로 넣으면 `sticky` 가 풀린다)", () => {
    const code = stripComments(read(SHELL));
    /* 2026-09-07 실측: 헤더를 `<div className="flex-1 overflow-auto">` **안**으로 옮기자
     *   그 조상이 `min-h-screen`(높이 제약 없음)이라 컨테이너가 스크롤되지 않았고,
     *   `sticky` 가 그 컨테이너에 묶여 고정이 풀렸다. 셸은 헤더를 스크롤러 **위 형제**로
     *   두어 그 형태가 성립하지 않게 한다 — 8곳이 버린 구조가 정확히 이것이다. */
    expect(code).toMatch(
      /<div className="flex h-screen overflow-hidden bg-white">[\s\S]*?<DashboardSidebar\b/,
    );
    const header = code.indexOf("<DashboardHeader />");
    const main = code.indexOf("<main");
    const mainEnd = code.indexOf("</main>");
    expect(header).toBeGreaterThan(-1);
    expect(main).toBeGreaterThan(-1);
    expect(mainEnd).toBeGreaterThan(main);
    // 헤더가 main 앞이다 = 스크롤러 안이 아니다
    expect(header).toBeLessThan(main);
    expect(code).toMatch(/<main[\s\S]{0,400}?overflow-y-auto/);
  });

  it("🔑 셸 부품의 렌더 지점이 **전역에서 하나**다 (복제 재발 0)", () => {
    /* 화면이 다시 부품을 직접 렌더하기 시작하면 다섯 번째 결함이 온다.
     *   여기는 8곳이 아니라 `src/app` 전역을 본다 — 새 화면이 자체 셸을 지어도 잡힌다. */
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const hits: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__") continue;
          walk(p);
        } else if (/\.tsx$/.test(e.name)) {
          const code = stripComments(readFileSync(p, "utf8"));
          if (/<DashboardSidebar\b/.test(code) || /<DashboardHeader\b/.test(code)) {
            hits.push(p.slice(p.indexOf("src")).replace(/\\/g, "/"));
          }
        }
      }
    })(join(WEB_ROOT, "src", "app"));
    expect(hits.sort()).toEqual([SHELL]);
  });

  it("🔑 BottomNav·모달 레이어도 셸이 쥔다 (8곳이 따로 달지 않는다)", () => {
    /* 자체 셸 8곳에는 `BottomNav` 가 아예 없었다 — 모바일 하단 내비가 그 화면들에서만
     *   사라졌다는 뜻이다. 셸을 쓰면 그게 자동으로 닫힌다. 반대로 화면이 스스로 달면
     *   `/dashboard` 에서 둘이 된다. */
    expect(stripComments(read(SHELL))).toMatch(/<BottomNav \/>/);
    for (const f of WRAPPED) {
      expect(stripComments(read(f))).not.toMatch(/<BottomNav\b/);
    }
  });
});
