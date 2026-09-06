/**
 * §wrapper-initial-visibility (호영님 2026-09-06) —
 * **콘텐츠를 감싸는 래퍼의 초기 상태가 콘텐츠를 비가시로 만들면 안 된다.**
 *
 * 사고 실측 — `/billing` 이 회색 막만 남고 본문이 통째로 사라졌다:
 *   inline `opacity: 0` · computed `0.85418` (애니메이션이 끝나기 직전에 멈춤)
 *   범인은 `app/template.tsx` → `PageTransition` 의 `initial={{ opacity: 0, y: 8 }}`.
 *   루트 template 이라 **전 라우트**를 감싼다 — `/billing` 만의 문제가 아니었다.
 *   평소엔 0.25초 만에 끝나 안 보이지만, 완료되지 않으면 페이지가 통째로 비가시가 된다.
 *   실패가 "덜 예쁨" 이 아니라 **전면 불능**으로 나타나는 구조였다.
 *
 * 🛑 이 파일은 **파일 이름도 컴포넌트 이름도 잠그지 않는다**(호영님 지시).
 *   잠글 명제는 하나다 — 래퍼의 초기 상태가 콘텐츠를 비가시로 만들면 RED.
 *   대상 축은 **루트 template/layout 계열과 그것이 렌더하는 컴포넌트**다(호영님 지정).
 *   `page-transition.tsx` 를 이름으로 고정하지 않고 template/layout 에서 **따라간다** —
 *   다음에 다른 이름으로 같은 구조를 만들어도 잡힌다.
 *
 * ⚠️ 축을 "{children} 을 렌더하는 모든 파일" 로 넓히면 **마케팅 섹션 리빌 13건**이 걸린다
 *   (intro·pricing·landing-sections·final-cta). 그건 의도된 스크롤 리빌이고 실패해도
 *   **그 섹션 하나만** 안 보인다 — 폭발 반경이 다르다. 같은 형태지만 같은 결함이 아니다.
 *   별건으로 기록하되 이 sentinel 의 축은 아니다.
 *
 * 🛑 고정 폭 슬라이스 금지 (4원칙 ⑤ · 오늘 같은 형태로 7번 자해했다).
 *   창은 `initial={{` 의 여는 중괄호 ↔ 대응 닫는 중괄호로 연다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * 루트 계열 = 모든 `template.tsx` · `layout.tsx`. 이름이 아니라 **역할**로 고른다.
 * 🛑 경로 구분자를 정규화한 뒤 판정한다 — Windows 는 `\`, POSIX 는 `/` 라
 *    한쪽만 보면 스코프가 통째로 0이 된다(2026-09-06 실측: 그래서 검사가 사라질 뻔했다).
 */
function layoutFiles(): string[] {
  return walk(join(REPO_ROOT, "src", "app")).filter((f) =>
    /\/(template|layout)\.tsx$/.test(f.split("\\").join("/")),
  );
}

/** 그 파일들이 렌더하는 컴포넌트까지 한 홉 따라간다(`@/…` import 만). */
function layoutScope(): string[] {
  const files = new Set(layoutFiles());
  for (const f of layoutFiles()) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/from\s+"@\/([^"]+)"/g)) {
      for (const ext of [".tsx", "/index.tsx"]) {
        const cand = join(REPO_ROOT, "src", m[1] + ext);
        try {
          readFileSync(cand, "utf8");
          files.add(cand);
        } catch {
          /* 그 경로가 아니면 넘어간다 — 해석 실패는 축 밖이다 */
        }
      }
    }
  }
  return [...files];
}

/** `initial={{ … }}` 의 **대응 닫는 중괄호**까지. 고정 폭을 쓰지 않는다. */
function initialObjects(code: string): string[] {
  const out: string[] = [];
  const re = /initial=\{\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let i = re.lastIndex;
    let depth = 2; // `{{` 두 개
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      i++;
    }
    out.push(code.slice(m.index, i));
  }
  return out;
}

/** 이 초기 상태가 콘텐츠를 **비가시**로 만드는가. */
function hidesContent(initial: string): string | null {
  if (/\bopacity\s*:\s*0(?!\.\d*[1-9])/.test(initial)) return "opacity: 0";
  if (/visibility\s*:\s*["']?hidden/.test(initial)) return "visibility: hidden";
  if (/display\s*:\s*["']?none/.test(initial)) return "display: none";
  return null;
}

describe("§wrapper-initial-visibility — 래퍼 초기 상태가 콘텐츠를 숨기지 않는다", () => {
  it("루트 template/layout 계열 어디에도 비가시 initial 이 없다 (전수 · 이름 고정 0)", () => {
    const scope = layoutScope();
    // 축이 비면 검사가 사라진다 — 스코프 자체를 먼저 잠근다.
    expect(scope.length).toBeGreaterThan(3);
    const hits: string[] = [];
    for (const f of scope) {
      const code = stripComments(readFileSync(f, "utf8"));
      // 콘텐츠를 감싸는 래퍼만 대상 — 자기 안에 {children} 을 렌더한다.
      if (!/\{\s*children\s*\}/.test(code)) continue;
      for (const init of initialObjects(code)) {
        const why = hidesContent(init);
        if (why) {
          const line = code.slice(0, code.indexOf(init)).split("\n").length;
          hits.push(
            `${f.slice(f.indexOf("src")).replace(/\\/g, "/")}:${line} → ${why}`,
          );
        }
      }
    }
    /* 2026-09-06 이전 실측: app/template.tsx → PageTransition 1건.
     * 그 하나가 전 라우트를 비가시로 만들 수 있었다. */
    expect(
      hits,
      `콘텐츠를 감싸면서 초기 상태가 비가시인 래퍼:\n${hits.join("\n")}`,
    ).toHaveLength(0);
  });

  it("루트 template 이 실재하고 그 래퍼가 여전히 children 을 렌더한다 (회귀 0)", () => {
    // 명제를 지키느라 래퍼를 통째로 없애 children 이 안 그려지면 그건 더 큰 결함이다.
    const tpl = readFileSync(join(REPO_ROOT, "src/app/template.tsx"), "utf8");
    expect(tpl).toMatch(/\{\s*children\s*\}/);
    const wrapper = readFileSync(
      join(REPO_ROOT, "src/components/layout/page-transition.tsx"),
      "utf8",
    );
    expect(wrapper).toMatch(/\{\s*children\s*\}/);
  });

  it("전환 자체는 남아 있다 — 실패해도 보이는 축(y)만 쓴다", () => {
    const src = stripComments(
      readFileSync(join(REPO_ROOT, "src/components/layout/page-transition.tsx"), "utf8"),
    );
    expect(src).toMatch(/initial=\{\{ y: 8 \}\}/);
    expect(src).toMatch(/animate=\{\{ y: 0 \}\}/);
  });

  it("🛑 안전 타이머로 덮는 형태가 아니다 (증상만 가리고 사유를 안 남긴다)", () => {
    const src = stripComments(
      readFileSync(join(REPO_ROOT, "src/components/layout/page-transition.tsx"), "utf8"),
    );
    expect(src).not.toMatch(/setTimeout|useEffect/);
  });
});
