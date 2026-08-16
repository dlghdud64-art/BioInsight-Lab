/**
 * §0-B-succession — dead 표면 계약 중 **정책분**의 라이브 재조준
 *
 * 배경: `components/products/product-completeness.tsx` 는 importer 0(dead)이다.
 *   그 파일을 대상으로 한 단언 26건이 `product-detail-refinement` ·
 *   `product-detail-completeness-pd-b` 에 남아 GREEN 이었다 — 아무도 렌더하지 않는
 *   파일을 검사하면서. §0-B 파일 계약(amber 8토큰 앵커)이 은퇴한 배치에서 같이 갈랐다.
 *
 * 🛑 순서 — 재조준 먼저, 삭제 나중.
 *   이 파일이 신설 단언이고, 구 단언은 아직 살아 있다(방어 공백 0).
 *   구 단언 삭제는 다음 배치. 그 배치가 끝나야 importer≥1 단언을 켤 수 있다.
 *
 * 라이브 표면 2곳:
 *   PENDING  components/products/pending-info-row.tsx  — 완성도 게이지의 승계자(50줄)
 *   PAGE     app/products/[id]/page.tsx                — 편집 진입 게이트 소유
 *
 * ⚠️ 부정 단언은 반드시 주석 제거본(`*_CODE`)에 건다.
 *    원본에 걸면 그 문구를 설명한 **주석까지 매칭**돼, 구현자가 주석을 지워 통과시킨다.
 *    (product-detail-refinement 에서 4회 재발한 형태 — PAGE L716 이 실제로
 *     "buyer 미생성, disabled 아님" 이라는 주석에 `disabled` 를 담고 있다.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const PENDING = root("components/products/pending-info-row.tsx");
const PAGE = root("app/products/[id]/page.tsx");
const PENDING_CODE = stripComments(PENDING);
const PAGE_CODE = stripComments(PAGE);

/* ─────────────────────────────────────────────────────────────
 * (b-1) 승계: refinement L94 `COMP_CODE not disabled`
 *   정책 — "액션이 없으면 버튼을 만들지 않는다". disabled 로 만들면 dead button 이다.
 *   구 단언은 체크리스트(dead)를 봤다. 라이브에서 이 정책을 지는 건 **권한 게이트**다.
 *   PAGE 의 disabled 7건은 전부 in-flight(isSavingSpec · isTranslating · creatingReorderQuote) — 정당하다.
 *   따라서 "권한 게이트가 disabled 로 구현되지 않는다" 로 좁혀 재조준한다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-1) — 권한 게이트에 dead button 0", () => {
  it("canEditSpec 게이트가 disabled 로 구현되지 않는다(미생성이 정책)", () => {
    const gated = PAGE_CODE.match(/canEditSpec[\s\S]{0,600}?disabled=/g) ?? [];
    expect({ 권한게이트_disabled: gated }).toEqual({ 권한게이트_disabled: [] });
  });
  it("승계 표면(PendingInfoRow)에 disabled 0 — 액션 0 설계", () => {
    expect(PENDING_CODE).not.toMatch(/disabled/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * (b-2) 승계: refinement L254 + pd-b L57 (동일 명제 2건 → 1건으로 수렴)
 *   §11.302 신호등 — 미등록은 **위험이 아니다**. red 톤 금지.
 *   구 단언은 dead COMP 를 봤다. 승계 표면에 그대로 건다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-2) — 미등록 표면 신호등(red 0)", () => {
  it("PendingInfoRow 에 red 톤 0 (미등록 ≠ 위험)", () => {
    expect(PENDING_CODE).not.toMatch(/bg-red-|text-red-|border-red-/);
  });
  it("PendingInfoRow 에 amber/orange 클래스 0 (302d6d2 정합)", () => {
    expect(PENDING_CODE).not.toMatch(/-amber-\d|-orange-\d/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * (b-3) 승계: refinement L342 `COMP_CODE not classified`
 *   D7 철회 — 액션 불가능한 항목(위험도 분류)을 체크리스트에 넣지 않는다.
 *   PAGE 쪽은 구 단언이 이미 라이브(`PAGE_CODE not classified={`). 승계 표면에 확장한다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-3) — 액션 불가 항목 미노출", () => {
  it("PendingInfoRow 에 위험도 분류(classified) 부재", () => {
    expect(PENDING_CODE).not.toMatch(/classified|위험도/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * (b-4) 승계: pd-b L40 `COMP computeCompleteness`
 *   산정 계층 단일 출처 — 컴포넌트가 자체 계산하지 않는다.
 *   완성도 %는 buyer 화면에서 은퇴했지만 **산정 lib 은 존치**(v21 §1) — 승계자가 그걸 쓴다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-4) — 산정 계층 단일 출처", () => {
  it("PendingInfoRow 가 computeCompleteness 를 쓴다(자체 계산 0)", () => {
    expect(PENDING).toMatch(/import \{ computeCompleteness \}/);
    expect(PENDING).toMatch(/computeCompleteness\(product\)/);
  });
});

/* ─────────────────────────────────────────────────────────────
 * (b-5) (d)에서 파생 — 라벨은 은퇴, 정책은 생존
 *   구 단언 L98/L347 은 `등록이 필요한 정보 ({length})` 라벨을 잠갔다. 라벨은 v21 에서
 *   `일부 정보 미등록 · 견적·문의 시 안내됩니다` 로 교체됐다 — 라벨 계약은 은퇴다.
 *   그러나 그 밑의 정책 **"미등록 사실을 은폐하지 않는다"** 는 살아 있고,
 *   지금 그걸 잠그는 단언이 **없다.** (d) 를 통째 삭제하면 이게 같이 사라진다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-5) — 미등록 은폐 0 (라벨 은퇴 · 정책 생존)", () => {
  it("미등록 항목을 목록으로 노출한다(숨김 게이트 0)", () => {
    expect(PENDING).toMatch(/missingLabels\.map\(/);
  });
  it("미등록 0건일 때만 미렌더 — 빈 줄/대시로 얼버무리지 않는다", () => {
    expect(PENDING).toMatch(/missingLabels\.length === 0\) return null/);
  });
  it("접힌 1줄이 미등록 사실을 문장으로 진술한다", () => {
    expect(PENDING).toMatch(/일부 정보 미등록/);
  });
});

describe("§0-B-succession — 도달성 가드 (해제 대기)", () => {
  /* 🛑 지금 켜면 RED 2 — `product-detail-refinement` · `product-detail-completeness-pd-b` 가
   *    아직 dead file 을 읽는다. 그건 **단언이 정확히 작동한다는 증거이지 결함이 아니다.**
   *
   *    해제 조건: (a) 7건 + (c) 6건 + (d) 8건 = 21 단언 삭제 배치 완료 후.
   *              그때 이 it 의 skip 을 떼면 RED 0 이어야 한다.
   *              (b) 5건은 위 재조준으로 이미 라이브에 승계됨 — 같이 삭제 가능.
   *
   *    2층(`미판정` 문자열)이 아니라 3층(자기무효화)에 가깝게 둔다 —
   *    해제 조건이 코드로 판별된다: 아래 SENTINELS 의 dead 참조가 0 이 되는 시점이다. */
  const SENTINELS = [
    "__tests__/regression/product-detail-refinement.test.ts",
    "__tests__/regression/product-detail-completeness-pd-b.test.ts",
  ];

  it.skip("sentinel 이 읽는 소스는 importer ≥ 1 이어야 한다(dead 표면 잠금 금지)", async () => {
    const { buildGraph, rel } = await import("../_helpers/import-graph");
    const g = buildGraph();
    const dead: string[] = [];
    for (const s of SENTINELS) {
      const src = root(s);
      for (const m of src.matchAll(/root\("([^"]+)"\)/g)) {
        const target = g.files.find((f) => rel(f) === m[1]);
        if (target && !g.isLive(target)) dead.push(`${s} → ${m[1]}`);
      }
    }
    expect({ dead표면_참조: dead }).toEqual({ dead표면_참조: [] });
  });
});

/* ─────────────────────────────────────────────────────────────
 * (b-6) (d)에서 파생 — buyer dead link 0
 *   구 단언 L46/L47/L48/L89(resolveCompletenessActions · href · 정보 요청)은
 *   "체크리스트가 액션을 준다" 를 잠갔다. v21 §1 이 그 반대로 뒤집었다 —
 *   buyer 에게는 편집·업로드·요청 링크를 **미생성**한다(dead link 0).
 *   뒤집힌 계약은 은퇴가 아니라 **역방향 잠금**이 필요하다. 없으면 회귀가 안 잡힌다.
 * ───────────────────────────────────────────────────────────── */
describe("§0-B-succession (b-6) — buyer 표면 액션 0 (역방향 잠금)", () => {
  it("PendingInfoRow 에 링크/앵커 0", () => {
    expect(PENDING_CODE).not.toMatch(/<Link|<a\s|href=/);
  });
  it("PendingInfoRow 의 유일한 인터랙션은 펼침 토글이다", () => {
    const clicks = PENDING_CODE.match(/onClick=/g) ?? [];
    expect(clicks.length).toBe(1);
    expect(PENDING_CODE).toMatch(/onClick=\{\(\) => setOpen/);
  });
});
