/**
 * §inventory-import-fake-success (2026-09-26 · 호영님 지시)
 *
 * **가짜 성공을 남기느니 기능이 없는 편이 낫다.** 그런데 이 건은 기능이 **있었다** —
 * 라이브 진입점이 가짜를 열고 있었을 뿐이다.
 *
 * ── 실측 (호영님 지시 1번: 「서버에 쓰는 경로가 있는지 재라」) ──
 * 재고 가져오기 UI 가 **셋**이었고, 라이브인 것만 가짜였다:
 * ```
 * 컴포넌트                          서버 호출            진입점        판정
 * import-staging-workbench.tsx      fetch·mutation 0     라이브 2곳    🛑 가짜
 *   handleFileUpload 이 file.name/size 만 쓰고 **파일을 읽지 않는다**
 *   → 컬럼 10개 하드코딩 + generateMockRows() → 검토 표가 **사용자 파일이 아니다**
 *   handleApply = setTimeout(1500) → importStagingStatus "applied" → 「N건 적용」
 * import-wizard.tsx                 preview + commit     importer 0    ✅ 실배선 · 렌더 안 됨
 * BulkImportModal.tsx               /api/inventory/bulk  진입점 0      ✅ 실배선 · 열 수 없음
 *                                                        (setIsImportDialogOpen 호출자 0)
 * ```
 * 저장 경로: `/api/inventory/import/preview` → `/commit`.
 * commit 은 `ImportJob` 을 만들고 `productInventory` 를 create/update 한다 — 진짜로 쓴다.
 *
 * ── 그래서 2번 분기 (저장 경로 있음 → 연결 · 성공 표시는 서버 응답 뒤에만) ──
 * 라이브 진입점을 `ImportWizard` 로 붙였다. 같은 모달 자리를 쓴다(same-canvas · 새 페이지 0).
 * 가짜는 배선을 끊었다 — importer 0 이 되어 렌더되지 않는다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 라이브 진입점이 실배선 위저드를 연다
 *   ② 가짜 컴포넌트가 **어디서도 import 되지 않는다**
 *   ③ 성공 화면이 **서버 응답 뒤에만** 그려진다 (호영님 지정 역계약)
 *   ④ 성공 숫자가 서버 값에서 온다 (mock 생성기 0)
 *   ⑤ 회귀 0 — 저장 경로가 실제로 쓴다
 *
 * ── 자기 한계 ──
 *   1. `BulkImportModal` 은 실배선이지만 **열리는 경로가 0** 이다(이 커밋이 만든 게 아니다).
 *      ⚠️ 정정 — 처음에 「진입점 0」 이라고만 적었는데 소비자가 **둘**이었다:
 *        (a) inventory-content 가 렌더하지만 `isImportDialogOpen` 을 true 로 만드는 곳이 0
 *        (b) `global-modal.tsx` 레지스트리의 `bulk_import` 키 — 그 키를 여는 곳도 0
 *            (`modal-store.ts` 의 유니온에만 선언돼 있다)
 *      래퍼·레지스트리를 안 세고 「호출자 0」 을 말하면 틀린다(§비교식 하나로 갈림 판정 금지의 ③ 형태).
 *      가져오기 경로가 둘이면 혼선이 되므로 **별도 판정**이 필요하다 — 이 파일은 그 축을 안 본다.
 *   ~~2. 가짜 파일을 지우지 않았다~~ → **지웠다**(호영님 git rm 승인 · 같은 커밋).
 *      `import-staging-workbench.tsx` · `lib/ai/inventory-import-staging-engine.ts` 둘 다.
 *      ⑥ 이 워킹트리·인덱스 두 축으로 부재를 단언한다. ② 의 import 부재는 **그대로 남긴다** —
 *      경로가 되살아나는 것과 파일이 되살아나는 것은 다른 사건이다.
 *   3. 소스 문자열만 본다. 런타임 응답은 보지 않는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

const PAGE = "app/dashboard/inventory/inventory-content.tsx";
const WIZARD = "components/inventory/import-wizard.tsx";
const FAKE = "components/inventory/import-staging-workbench.tsx";

/** 블록 경계로 연다 · 고정 폭 슬라이스 금지(4원칙 ⑤). */
function fnBlock(src: string, anchor: string): string {
  const start = src.indexOf(anchor);
  expect(start, `앵커 부재: ${anchor}`).toBeGreaterThan(-1);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`닫는 중괄호 없음: ${anchor}`);
}

describe("§inventory-import-fake-success · 라이브 진입점이 실배선을 연다", () => {
  it("① 진입점 2곳이 위저드를 열고, 위저드가 모달 안에 렌더된다", () => {
    const src = code(PAGE);
    expect(src).toMatch(/import\("@\/components\/inventory\/import-wizard"\)/);
    const opens = src.match(/setIsImportWizardOpen\(true\)/g);
    expect(opens ?? []).toHaveLength(2); // 빠른 액션 · 더보기
    expect(src).toMatch(/<Dialog open=\{isImportWizardOpen\}/);
    expect(src).toMatch(/<ImportWizard[\s\S]{0,400}onSuccess=\{/);
    /* 성공 시 목록을 다시 읽는다 — 서버에 실제로 들어갔으니 화면도 갱신돼야 한다.
       🛑 근접 매칭으로 세면 한 줄을 지워도 다음 줄이 대신 걸린다(프로브 ①-3 이 잡았다 · 4원칙 ④).
       블록 경계로 열고 **두 축을 각각** 단언한다 — 목록과 팀 재고는 다른 쿼리키다. */
    /* 창은 **위저드 렌더 자리**부터 연다 — 파일에 onSuccess 가 여러 모달에 있어서
       이름만으로 열면 남의 모달에 걸린다(4원칙 ② 창 시작점). */
    const wStart = src.indexOf("<ImportWizard");
    expect(wStart, "위저드 렌더 자리 부재").toBeGreaterThan(-1);
    const onSuccess = src.slice(wStart, src.indexOf("</Dialog>", wStart));
    expect(onSuccess).toMatch(/setIsImportWizardOpen\(false\)/);
    expect(onSuccess).toMatch(/queryKey: \[\s*"inventories"/);
    expect(onSuccess).toMatch(/queryKey: \[\s*"team-inventory"/);
  });

  it("② 가짜 컴포넌트가 어디서도 import 되지 않는다", () => {
    /* 파일은 ⑥ 이 부재를 단언한다. 여기서 보는 것은 **경로**다 —
       파일이 없어도 누가 같은 이름으로 다시 만들면 이 단언이 먼저 선다.
       이름 문자열이 아니라 사용 지점의 형태로 묻는다(§"X를 쓰는가" 에 grep 으로 답하지 않는다). */
    expect(code(PAGE)).not.toMatch(/import-staging-workbench/);
    expect(code(PAGE)).not.toMatch(/<ImportStagingWorkbench/);
    expect(code(PAGE)).not.toMatch(/isImportStagingOpen/);
  });
});

describe("§inventory-import-fake-success · 성공은 서버 응답 뒤에만", () => {
  it("③ 성공 단계 전환이 응답 파싱 **뒤**에 온다 (호영님 지정 역계약)", () => {
    const src = code(WIZARD);
    const commit = fnBlock(src, "const handleCommit");
    // 순서를 본다 — 응답을 읽기 전에 단계를 넘기면 그게 가짜 성공이다.
    /* 🛑 "await response.json()" 로 찾으면 **실패 분기의 파싱**(if (!response.ok))에 먼저 걸린다.
       그 자리는 항상 setStep 보다 앞이라 순서 단언이 언제나 통과했다(프로브 ③ 이 잡았다 · 4원칙 ②).
       성공 경로의 파싱을 그 자리에서만 나타나는 형태로 찾는다. */
    const jsonAt = commit.indexOf("const result: ImportResult = await response.json()");
    const stepAt = commit.indexOf('setStep("commit")');
    expect(jsonAt, "응답 파싱이 없다").toBeGreaterThan(-1);
    expect(stepAt, "성공 단계 전환이 없다").toBeGreaterThan(-1);
    expect(jsonAt).toBeLessThan(stepAt);
    // 응답이 실패면 던진다 — 실패를 성공으로 넘기지 않는다.
    expect(commit).toMatch(/if \(!response\.ok\)[\s\S]{0,400}throw /);
    // 성공 화면은 서버 결과가 있을 때만 그려진다.
    expect(src).toMatch(/step === "commit" && importResult/);
  });

  it("④ 성공 숫자가 서버 값에서 온다 · 타이머가 성공을 만들지 않는다", () => {
    const src = code(WIZARD);
    const commit = fnBlock(src, "const handleCommit");
    expect(commit).toMatch(/setImportResult\(result\)/);
    /* 🛑 setTimeout 자체를 금지하지 않는다 — 이 위저드는 성공 **뒤**에 confetti·이동에 쓴다.
       금지할 것은 **타이머가 성공 상태를 만드는 것**이다. */
    expect(commit).not.toMatch(/setTimeout\([\s\S]{0,200}setStep\("commit"\)/);
    expect(commit).not.toMatch(/setTimeout\([\s\S]{0,200}setImportResult/);
    // mock 생성기를 쓰지 않는다(가짜가 쓰던 것).
    expect(src).not.toMatch(/generateMockRows|simulateAIColumnMapping/);
  });
});

describe("회귀 0 · 저장 경로가 실제로 쓴다", () => {
  it("⑤ preview·commit 라우트가 있고 commit 이 재고를 기록한다", () => {
    expect(existsSync(join(SRC, "app/api/inventory/import/preview/route.ts"))).toBe(true);
    const commitRoute = read("app/api/inventory/import/commit/route.ts");
    expect(existsSync(join(SRC, "app/api/inventory/import/commit/route.ts"))).toBe(true);
    // 「쓴다」 는 사용 지점의 형태로 묻는다.
    expect(commitRoute).toMatch(/db\.productInventory\.create\(/);
    expect(commitRoute).toMatch(/db\.productInventory\.update\(/);
    expect(commitRoute).toMatch(/db\.importJob\.create\(/);
  });

  it("⑥ 가짜 파일이 삭제됐다 (워킹트리·인덱스 두 축)", () => {
    /* 승계 §inventory-import-fake-success (2026-09-26 · 호영님 지시) — 처음엔 배선만 끊고 파일을 남겼다(git rm 사전 승인 필요).
       호영님 승인으로 지웠다. 무엇을 되살리면 안 되는지는 **이 파일 머리말**이 들고 있다 —
       파일이 사라졌으므로 기록은 여기에만 남는다.
       🛑 삭제 명제는 두 축을 **둘 다** 본다(CLAUDE.md §파일 삭제는 HEAD 축과 워킹트리 축):
          existsSync 는 워킹트리를, git ls-files 는 인덱스를 읽는다. 둘 다 봐야 「지웠다」 가 참이다. */
    for (const rel of [FAKE, "lib/ai/inventory-import-staging-engine.ts"]) {
      expect(existsSync(join(SRC, rel)), rel + " 워킹트리").toBe(false);
      /* 🔑 축은 **인덱스**(git ls-files)다. HEAD 를 보면 git rm 을 스테이징한 시점에는 아직 파일이
         있어서 **커밋 전 게이트가 반드시 RED** 가 된다 — 구조적으로 한 커밋 늦다.
         인덱스는 git rm 직후 비므로 커밋 전에 잡히고, 커밋 뒤에도 그대로 빈다.
         (CLAUDE.md §파일 삭제는 HEAD 축과 워킹트리 축을 둘 다 봐야 게이트에 잡힌다 의 실행형) */
      const tracked = execSync("git ls-files -- " + JSON.stringify("apps/web/src/" + rel), {
        cwd: join(SRC, "..", "..", ".."),
        encoding: "utf8",
      }).trim();
      expect(tracked, rel + " 인덱스").toBe("");
    }
  });
});
