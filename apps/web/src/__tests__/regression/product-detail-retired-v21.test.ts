/**
 * §product-detail-retired-v21 — **이력 파일**. 활성 단언 0.
 *
 * 🛑 이 파일은 이력이다. 여기 있는 것은 전부 `it.skip` 이고, 하나도 잠그지 않는다.
 *
 * ⚠️ 수를 셀 때 축을 먼저 볼 것 — 이 파일은 두 축의 수가 다르다.
 *
 *     단언 축   expect 8      ← 지시문·판정문이 말하는 "(d) 8건"
 *     it   축   it.skip 6     ← vitest 가 세는 수
 *
 *   `8개 skip` 을 찾으면 못 찾는다. 한 it 에 단언이 여럿 들어간 블록이 있어서다
 *   (pd-b 의 `resolveCompletenessActions` · `href` · `정보 요청` 이 한 블록).
 *   같은 형태로 2026-08-16 배치에서 "감소분 13" 이 it 축으로는 -4 였다.
 *
 * v21 §1(2026-08-09 호영님 승인)이 완성도 게이지를 buyer 표면에서 은퇴시켰다 —
 * 행동 불가한 내부 데이터 품질 정보가 상단을 점유했다는 판정이었다. 아래 8건은
 * **그 결정 이전의 계약**이다. 삭제하면 "결정이 있었다" 가 사라진다.
 *
 * ── 왜 (a)구현 종속 도 (c)중복 도 아닌가 ──
 *   (a)로 묶으면 "구현이 바뀌었다" 로 읽혀 결정의 존재가 지워지고,
 *   (b)로 묶으면 재조준 대상을 찾다가 없어서 "계약이 깨졌다" 로 오판한다.
 *   → (d) 결정 은퇴. DECISION_reorder-handoff §9 `§decision-retired` 참조.
 *
 * ── 살아 있는 정책은 어디 있나 ──
 *   product-detail-succession-0b.test.ts 가 라이브 표면에서 잠근다.
 *     b-5  미등록 은폐 0        ← 라벨은 은퇴, 정책은 생존
 *     b-6  buyer 액션 0         ← 계약이 **뒤집혔다** → 역방향 잠금
 *   🛑 뒤집힌 계약은 은퇴가 아니다. 금지의 잠금이 필요하다.
 *
 * ── 도달성 가드와의 관계 ──
 *   이 파일은 dead file(product-completeness.tsx, importer 0)을 읽는다.
 *   그래도 가드가 RED 를 내지 않는다 — 가드 명제가 **"활성 it 이 1개 이상인"**
 *   파일로 좁혀져 있기 때문이다. 잠그지 않는 파일은 잠금 검사 대상이 아니다.
 *   🛑 여기서 skip 을 하나라도 떼면 이 파일이 검사 대상이 되고 가드가 RED 다.
 *      그게 의도다 — 이력을 다시 게이트로 쓰려면 대상부터 살려야 한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const COMP = root("components/products/product-completeness.tsx");

describe("§product-detail-retired-v21 — 완성도 게이지 은퇴 이전 계약 (전량 skip)", () => {
  /* ← product-detail-refinement.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
    //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
    it.skip("권한 밖 항목이 정보 요청으로 수렴 (편집 라벨 단언 2건은 PAGE 로 승계·삭제됨)", () => {
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — v21 §1 로 체크리스트 액션 전면 폐기(buyer 액션 0). 역방향 잠금은 succession b-6
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/정보 요청/);
    });

  /* ← product-detail-refinement.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
    //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
    it.skip("미등록 목록 노출 (2열 그리드 단언은 구현 종속으로 삭제됨)", () => {
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — 라벨이 `일부 정보 미등록 · 견적·문의 시 안내됩니다` 로 교체. 정책은 succession (b-5) 로 생존
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/등록이 필요한 정보/);
    });

  /* ← product-detail-refinement.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
    //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
    it.skip("100% 시 배지 숨김 보존", () => {
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — 완성도 게이지 자체가 buyer 표면에서 은퇴(v21 §1). 승계 조건은 succession (b-5)
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/if \(pct >= 100\) return null/);
    });

  /* ← product-detail-refinement.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
    //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
    it.skip("D8: 항목 수 리터럴 하드코딩 금지(프로토타입 6 = 샘플값)", () => {
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — `등록이 필요한 정보 ({length})` 라벨 폐기. 파생 렌더 정책은 succession (b-5)
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/등록이 필요한 정보 \(\{[\s\S]{0,40}?length\}\)/);
    });

  /* ← product-detail-completeness-pd-b.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    위 it 과 한 블록이었으나 (b)/(d) 혼재라 분리했다 — skip 은 it 단위라 섞이면 못 가른다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5 의 근거다.
    it.skip("100%면 배지 숨김 (게이지 은퇴 — 승계 조건은 succession b-5)", () => {
      expect(COMP).toMatch(/if \(pct >= 100\) return null/);
    });

  /* ← product-detail-completeness-pd-b.test.ts */
    // 🔁 (d) 결정 은퇴 — v21 §1(2026-08-09 호영님 승인)이 이 계약을 뒤집었다.
    //    삭제하지 않는다: 이력이고, §0-B-succession b-5·b-6 의 근거다.
    //    skip 인 이유 — dead file 대상이라 통과해도 방어력 0. 정책은 succession 이 라이브로 진다.
    it.skip("미등록 = 역할별 액션 그리드 + 정보 요청(실 라우트 /support, dead button 0)", () => {
      // §product-detail-refinement Phase 3(3a7f6e01) — 1줄 축약(missingLabels.join) 폐기,
      //   resolveCompletenessActions 파생 그리드로 재작성. pd-b 를 그 설계로 진화(2026-07-26).
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — v21 §1 이 buyer 액션 0 으로 뒤집음. 역방향 잠금은 succession (b-6)
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/resolveCompletenessActions/);
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — 동상. buyer 에게 링크 미생성이 현행 정책(dead link 0)
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/href/);
      // 🛑 은퇴 예정 (d) 결정 은퇴 — 3분류 밖(신설) — dead file(product-completeness.tsx, importer 0) 대상.
      //    결정 은퇴 — 동상. 요청 링크도 buyer 미생성
      //    삭제는 §0-B-succession 다음 배치. 이 주석이 있는 동안 통과해도 방어력 0.
      expect(COMP).toMatch(/정보 요청/);
    });
});
