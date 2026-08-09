/**
 * §product-detail §4 — 재발주 배너 (B2, 2026-08-09)
 *
 * 배경: §4 계약의 목적은 `재발주안에 합류` 라는 **라벨**이 아니라 **새 견적 중복 생성 방지**다.
 *   그런데 기존 경로(ReorderReviewSheet.handleRequestQuote)는 누를 때마다 새 초안을
 *   생성한다 — 합류하는 동작이 없다. 그 상태로 배너를 달면 ① 라벨이 실동작과 다르고
 *   ② §4 가 막으려던 중복 생성 진입점을 하나 더 여는 꼴이 된다(거짓 보증 클래스).
 *   → 중복 방지를 **동작으로** 구현한다: 작성 중 견적이 있으면 열고, 없을 때만 만든다.
 *
 * 계약:
 *   R1. 조회 = GET /api/quotes?productId=&status=PENDING (B2 신설 필터).
 *   R2. **스코프 대체 금지** — 서버가 제품 필터를 ownerCondition(userId OR 소속 조직)과
 *       AND 로 결합해야 한다. 대체하면 남의 조직 견적이 "작성 중"으로 뜬다 = 사고.
 *   R3. 라벨↔동작 일치 — `합류` 라벨 금지(합류하지 않는다).
 *   R4. CTA 2분기 — 조회 결과 유무로 갈린다. 있으면 열기(쓰기 0), 없으면 생성.
 *   R5. 생성 진입점은 배너에 **하나만**(중복 진입점 0).
 *   R6. 열기 CTA 에 "재발주" 를 붙이지 않는다 — 그 견적의 출처를 모른다(의도적 비대칭).
 *       생성 CTA 는 목적을 아니까 "재발주 견적 만들기".
 *   R7. 출처(specialNotes) 텍스트 분기 금지 — §text-coupling-debt 를 늘리고,
 *       중복 방지 관점에서 출처는 무관하며 오히려 놓친다.
 *   R8. 트리거는 FK 정확 신호(안전재고 미달)만 — reorder-recommendation 텍스트 매칭 미사용.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");

const PAGE = read("src/app/products/[id]/page.tsx");
const API = read("src/app/api/quotes/route.ts");

/**
 * 부정 단언은 **주석 제거본**에 건다 (§product-detail refinement 계보 승계).
 *   금지 문구를 "쓰지 않는다"고 설명하는 주석 자체가 매칭돼 false RED 가 나고,
 *   그러면 구현자가 **주석을 지워서 통과**시키는 유인이 생긴다(자기함정).
 *   실제로 이 파일 최초 작성 시 R8 이 그렇게 걸렸다.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const PAGE_CODE = stripComments(PAGE);

/** 배너 JSX 구간 — 주석 제거본에서 고유 앵커로 슬라이스 */
const BANNER = (() => {
  const start = PAGE_CODE.indexOf("(openDraftQuote || needsReorder) &&");
  return start === -1 ? "" : PAGE_CODE.slice(start, start + 2600);
})();

describe("§4 R1·R2 — 조회 소스와 스코프 보존", () => {
  it("R1 페이지가 productId + status=PENDING 로 조회", () => {
    expect(PAGE).toMatch(/\/api\/quotes\?productId=\$\{encodeURIComponent\(id\)\}&status=PENDING/);
  });

  it("R2 서버가 productId 필터를 수신", () => {
    expect(API).toMatch(/searchParams\.get\("productId"\)/);
  });

  it("R2 제품 필터는 items.some(productId) 로 AND 결합", () => {
    expect(API).toMatch(/andTerms\.push\(\{ items: \{ some: \{ productId: productIdFilter \} \} \}\)/);
  });

  it("R2 ownerCondition 이 AND 의 첫 항으로 보존 — 스코프 대체 0", () => {
    // 제품 필터가 ownerCondition 을 밀어내면 남의 조직 견적이 노출된다.
    expect(API).toMatch(/const andTerms: Record<string, unknown>\[\] = \[ownerCondition\]/);
    expect(API).toMatch(/OR: \[\s*\{ userId: user\.id \}/);
  });
});

describe("§4 R3·R6 — 라벨이 실동작과 일치", () => {
  it("R3 '합류' 라벨 0 — 합류하는 동작이 없다", () => {
    expect(BANNER).not.toMatch(/합류/);
  });

  it("R6 열기 CTA 는 '작성 중인 견적 열기' (출처 미상이므로 '재발주' 미부착)", () => {
    expect(BANNER).toMatch(/작성 중인 견적 열기/);
    expect(BANNER).not.toMatch(/작성 중인 재발주 견적/);
  });

  it("R6 생성 CTA 는 '재발주 견적 만들기' (목적을 알므로 부착 가능)", () => {
    expect(BANNER).toMatch(/재발주 견적 만들기/);
  });
});

describe("§4 R4·R5 — 2분기 · 생성 진입점 1개", () => {
  it("R4 조회 결과 유무로 CTA 가 갈린다", () => {
    expect(BANNER).toMatch(/openDraftQuote \?/);
  });

  it("R4 열기 분기는 쓰기 0 — 이동만 한다", () => {
    expect(BANNER).toMatch(/reorder-open-draft-cta[\s\S]{0,400}?router\.push/);
    // 열기 분기 안에서 생성 핸들러를 부르면 계약 위반.
    const openBranch = BANNER.slice(0, BANNER.indexOf("안전재고 미달 · 재발주 권장"));
    expect(openBranch).not.toMatch(/handleCreateReorderQuote/);
  });

  it("R5 배너의 생성 진입점은 정확히 1개", () => {
    const hits = BANNER.match(/handleCreateReorderQuote/g) ?? [];
    expect(hits.length).toBe(1);
  });

  it("R5 페이지 전체에서 견적 생성 POST 는 이 배너 경로 하나뿐", () => {
    const posts = PAGE_CODE.match(/csrfFetch\("\/api\/quotes"/g) ?? [];
    expect(posts.length).toBe(1);
  });
});

describe("§4 R7·R8 — 텍스트 결속 미도입", () => {
  it("R7 specialNotes 출처 문자열로 분기하지 않는다", () => {
    // 생성 시 메타로 남기는 것은 허용. **분기 조건**으로 읽는 것이 금지.
    expect(PAGE_CODE).not.toMatch(/specialNotes[\s\S]{0,120}?(includes|contains|startsWith)\(/);
  });

  it("R8 트리거는 안전재고 미달(FK 정확) — reorder-recommendation 텍스트 매칭 미사용", () => {
    expect(PAGE_CODE).toMatch(/const needsReorder = reorderShortfall > 0/);
    expect(PAGE_CODE).not.toMatch(/useReorderRecommendation/);
  });
});

describe("§4 회귀 0 — 실패를 성공처럼 보이지 않는다", () => {
  it("생성 실패 시 이동 0 + 에러 표기", () => {
    const handler = PAGE_CODE.slice(PAGE_CODE.indexOf("const handleCreateReorderQuote"));
    expect(handler.slice(0, 1800)).toMatch(/if \(!res\.ok\)[\s\S]{0,400}?variant: "destructive"/);
    // 실패 분기에서 router.push 가 나오면 placeholder success.
    const failBranch = handler.slice(handler.indexOf("if (!res.ok)"), handler.indexOf("const body = await res.json()"));
    expect(failBranch).not.toMatch(/router\.push/);
  });
});
