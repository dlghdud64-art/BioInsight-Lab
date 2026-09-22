/**
 * §em-dash-added-lines · 수정 파일의 추가된 줄 게이트 (호영님 권고 승인 2026-09-22)
 *
 * 실측 결함: 삭제 모달 문구의 em dash 가 게이트·빌드·원장을 전부 통과해 prod 까지 갔다.
 *   `check-em-dash-new-files.ts` 는 **신규 추가 파일만** 본다. 그 파일은 수정(M) 이라 검사 대상이 아니었다.
 *   sentinel 이 약한 게 아니라 **검사 대상 집합에 없었다.**
 *
 * 이 계약이 무는 것: diff 파싱이 "이번 커밋이 추가한 줄" 을 정확히 집어내는가.
 *   레거시 6,926건을 건드리지 않는 근거가 전부 이 파싱에 달려 있다 — 범위가 새면 무관한 파일이 RED 가 된다.
 */
import { describe, it, expect } from "vitest";
import { parseAddedLines } from "../_helpers/em-dash-scan";

const D = (s: string) => s.replace(/\n$/, "");

describe("§em-dash-added-lines · 추가된 줄만 집어낸다", () => {
  it("① hunk 시작 번호부터 + 줄마다 1씩 · 삭제 줄은 세지 않는다", () => {
    const diff = D(`
diff --git a/apps/web/src/a.tsx b/apps/web/src/a.tsx
--- a/apps/web/src/a.tsx
+++ b/apps/web/src/a.tsx
@@ -10,1 +10,3 @@
-old line
+new one
+new two
+new three
`);
    const m = parseAddedLines(diff);
    expect(Array.from(m.get("apps/web/src/a.tsx")!).sort((x, y) => x - y)).toEqual([10, 11, 12]);
  });

  it("② hunk 가 여러 개면 각자의 시작 번호에서 다시 센다", () => {
    const diff = D(`
+++ b/apps/web/src/b.ts
@@ -1,0 +5,1 @@
+five
@@ -20,0 +100,2 @@
+hundred
+hundred one
`);
    expect(Array.from(parseAddedLines(diff).get("apps/web/src/b.ts")!).sort((x, y) => x - y))
      .toEqual([5, 100, 101]);
  });

  it("③ ts/tsx 가 아닌 파일은 대상이 아니다", () => {
    const diff = D(`
+++ b/apps/web/src/style.css
@@ -1,0 +1,1 @@
+.x { color: red }
+++ b/apps/web/docs/plans/x.md
@@ -1,0 +1,1 @@
+문서 줄
`);
    expect(parseAddedLines(diff).size).toBe(0);
  });

  it("④ 파일이 여럿이면 각각 따로 모은다 · 앞 파일의 상태가 새지 않는다", () => {
    const diff = D(`
+++ b/apps/web/src/one.tsx
@@ -1,0 +3,1 @@
+a
+++ b/apps/web/src/two.tsx
@@ -1,0 +7,1 @@
+b
`);
    const m = parseAddedLines(diff);
    expect(Array.from(m.keys()).sort()).toEqual(["apps/web/src/one.tsx", "apps/web/src/two.tsx"]);
    expect(Array.from(m.get("apps/web/src/one.tsx")!)).toEqual([3]);
    expect(Array.from(m.get("apps/web/src/two.tsx")!)).toEqual([7]);
  });

  it("⑤ 삭제만 있는 hunk 는 아무 줄도 만들지 않는다 · 지우기만 해도 RED 가 되면 안 된다", () => {
    const diff = D(`
+++ b/apps/web/src/c.tsx
@@ -4,2 +3,0 @@
-gone one
-gone two
`);
    expect(parseAddedLines(diff).has("apps/web/src/c.tsx")).toBe(false);
  });

  it("⑥ `+++` 헤더 자체를 추가 줄로 세지 않는다", () => {
    const diff = D(`
+++ b/apps/web/src/d.tsx
@@ -1,0 +1,1 @@
+only this
`);
    expect(Array.from(parseAddedLines(diff).get("apps/web/src/d.tsx")!)).toEqual([1]);
  });

  it("⑦ 빈 diff 는 빈 결과 · 검사 대상이 없으면 조용히 통과한다", () => {
    expect(parseAddedLines("").size).toBe(0);
  });
});
