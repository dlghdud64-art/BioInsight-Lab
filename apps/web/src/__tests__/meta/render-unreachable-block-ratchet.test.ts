/**
 * §render-unreachable-block-ratchet — 렌더에 도달하지 않는 블록 래칫 (호영님 판정 2026-09-26)
 *
 * 🛑 이것은 **래칫**이다(ratchet). 상한을 넘으면 RED 이고, 원장(red-ledger)에 담지 않는다.
 *
 * 왜 생겼나 — §inventory-dead-tabs-removed 실측:
 *   `inventory-content.tsx`(라이브 파일) 안에 `{false && (…)}` 블록 3개가 639줄 있었고,
 *   **센티넬 31건이 그 안을 재면서 GREEN 이었다.** 도달성 가드(「이 파일이 라이브 경로에 물려 있는가」)는
 *   전부 통과한다 — 파일은 살아 있으니까. 축이 파일이면 파일 안의 죽은 구역을 보지 못한다.
 *   그 GREEN 중 일부는 CLAUDE.md 조항 본문에 「라이브 승계 유지(vitest GREEN 실측)」 로 기록되기까지 했다.
 *   같은 블록에 값을 대는 쿼리는 살아 있어서 화면을 열 때마다 품목당 요청이 나갔다 — 렌더 0 ≠ 비용 0.
 *
 * 무엇을 세는가 — 제품 소스(`__tests__` 제외)에서 **주석을 지운 뒤** 항상 거짓인 렌더 가드를 센다.
 *   `{false &&` · `{false ?` · `if (false)` · `{0 &&`
 *   현재 0 이다. 그래서 래칫 상한도 0 — 예외 목록 대신 0 을 단언한다(§예외 목록에는 만료일과 소유자).
 *
 * 남은 축(별건 · 「렌더 도달 0 census」 큐):
 *   ① 소비자 0 인 지역 컴포넌트(이번 건의 `InventoryCard`·`TeamInventoryCard`·`InventoryForm` 형태).
 *      🛑 수치는 적지 않는다 — 첫 계측 시도가 정규식 손상으로 272 라는 거짓 수를 냈다.
 *         믿을 수 있는 검출기를 만든 뒤 그 큐에서 센다(§프로브에는 카나리).
 *   ② 주석으로 감싸 둔 JSX 블록.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const WEB = join(__dirname, "..", "..", "..");
const SRC = join(WEB, "src");

/** 상한. 🛑 올리지 않는다 — 올려야 할 상황이면 그 블록을 지우는 것이 처방이다. */
const CEILING = 0;

const ALWAYS_FALSE = [
  /\{\s*false\s*&&/,
  /\{\s*false\s*\?/,
  /if\s*\(\s*false\s*\)/,
  /\{\s*0\s*&&/,
];

/** 주석을 지운다 — 블록 주석은 줄 수를 보존하도록 공백으로 치환한다. */
function strip(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

function scan(): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "__tests__" || e.name === "node_modules") continue;
        walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      strip(readFileSync(p, "utf8")).split("\n").forEach((line, i) => {
        if (ALWAYS_FALSE.some((re) => re.test(line))) {
          hits.push(relative(SRC, p).split("\\").join("/") + ":" + (i + 1) + "  " + line.trim().slice(0, 90));
        }
      });
    }
  };
  walk(SRC);
  return hits;
}

describe("§render-unreachable-block-ratchet · 항상 거짓인 렌더 가드", () => {
  it("측정 도구가 작동한다 (카나리) · 0 을 성공 신호로 먼저 읽지 않는다", () => {
    /* 🛑 「0 곳」 이 나왔을 때 그것이 「없다」 인지 「안 봤다」 인지 먼저 가른다.
     *    스캐너에 알려진 양성을 먹여 검출을 확인하고, 실제로 파일을 읽었는지도 센다. */
    const probe = strip('const a = 1; // {false && ok}\nreturn <>{false && (<div/>)}</>;');
    expect(ALWAYS_FALSE.some((re) => re.test(probe.split("\n")[0]))).toBe(false); // 주석은 세지 않는다
    expect(ALWAYS_FALSE.some((re) => re.test(probe.split("\n")[1]))).toBe(true); // 코드는 센다
    let files = 0;
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "__tests__" || e.name === "node_modules") continue;
          walk(p);
        } else if (/\.(ts|tsx)$/.test(e.name)) files++;
      }
    };
    walk(SRC);
    expect(files).toBeGreaterThan(500);
  });

  it("상한 " + CEILING + " 이하 · 늘어나면 RED", () => {
    const hits = scan();
    /* 위반 위치를 메시지로 남긴다 — 다음 사람이 세는 방법을 다시 만들지 않게. */
    expect(hits, "항상 거짓인 렌더 가드가 늘었다:\n" + hits.join("\n")).toHaveLength(CEILING);
  });
});
