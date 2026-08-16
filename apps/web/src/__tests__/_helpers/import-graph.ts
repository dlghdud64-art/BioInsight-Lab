/**
 * import 그래프 — 명세 해석(specifier resolution) 기반 importer 계수.
 *
 * 🛑 basename 역참조 금지. 그건 importer 축이 아니라 **파일명 축**이다.
 *    2026-08-16 실측: basename 매칭은 dead 오음 2건(inventory-reorder-blocked-sheet ·
 *    inventory-context-panel — 둘 다 inventory-content.tsx 가 import)과
 *    라이브 오탐 2건(App Router 의 page.tsx 끼리 서로를 붙잡음)을 냈다.
 *    그 결과로 갔으면 **살아 있는 잠금 2건을 은퇴**시켰다.
 *
 * 해석 규칙: `@/` → src/ · 상대경로 · 확장자(.ts/.tsx)/index 후보. 패키지는 제외.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, normalize } from "node:path";

export const SRC_DIR = join(__dirname, "..", "..");

const posix = (p: string) => p.replace(/\\/g, "/");
export const rel = (f: string) => posix(relative(SRC_DIR, f));

export function walkSource(dir: string = SRC_DIR): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkSource(full));
    else if (/\.tsx?$/.test(entry)) out.push(posix(full));
  }
  return out;
}

export const isTestFile = (f: string) => /__tests__|\.test\.tsx?$/.test(posix(f));

/** Next.js App Router 진입점 — importer 0 이 정상이다 */
export const isRouteEntry = (f: string) =>
  /\/app\/.*\/(page|layout|route|template|error|loading|not-found)\.tsx?$/.test(posix(f));

export interface Graph {
  files: string[];
  read: (f: string) => string;
  /** 파일 → 그 파일을 import 하는 파일들 */
  importersOf: (f: string) => string[];
  /** 렌더 도달 가능: 라우트 진입점이거나 비-테스트 importer ≥ 1 */
  isLive: (f: string) => boolean;
}

export function buildGraph(): Graph {
  const files = walkSource();
  const set = new Set(files);
  const src = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
  const imps = new Map<string, string[]>(files.map((f) => [f, []]));

  const resolve = (spec: string, from: string): string | null => {
    let base: string;
    if (spec.startsWith("@/")) base = posix(join(SRC_DIR, spec.slice(2)));
    else if (spec.startsWith(".")) base = posix(normalize(join(dirname(from), spec)));
    else return null;
    for (const c of [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx"])
      if (set.has(c)) return c;
    return null;
  };

  for (const [f, s] of src)
    for (const m of s.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const t = resolve(m[1], f);
      if (t && t !== f) imps.get(t)!.push(f);
    }

  return {
    files,
    read: (f) => src.get(f) ?? readFileSync(f, "utf8"),
    importersOf: (f) => imps.get(posix(f)) ?? [],
    isLive: (f) =>
      isRouteEntry(f) || (imps.get(posix(f)) ?? []).some((x) => !isTestFile(x)),
  };
}
