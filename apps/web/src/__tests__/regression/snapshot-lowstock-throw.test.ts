/**
 * §snapshot-lowstock-throw (호영님 2026-09-10) —
 * **관계 필터가 던져서 대시보드 지표가 항상 0이었다.**
 *
 * 실측 2026-09-08 빌드 로그(로컬 operator-shell · `next build`): 같은 에러가 **8회 이상**.
 * ```
 * Invalid `prisma.productInventory.count()` invocation:
 *   where: { product: { organizationId: "cms…" }, currentQuantity: { lt: 10 } }
 *                       ~~~~~~~~~~~~~~
 *   ?     is?: ProductWhereInput,
 *   ?     isNot?: ProductWhereInput
 * Unknown argument `organizationId`.
 * ```
 * 🛑 원인은 관계 필터 문법이 아니라 **없는 필드**였다.
 *   `Product` 에는 `organizationId` 가 **아예 없다**(prod information_schema 실측).
 *   그래서 `product: { organizationId }` 도, `product: { is: { organizationId } }` 도 던진다 —
 *   `is:` 는 관계 필터 문법을 고칠 뿐 없는 필드를 만들지 않는다.
 *   `ProductInventory` 는 **자기** `organizationId` 를 갖는다. 그걸 써야 한다.
 *   (prod 직접 질의로 세 형태를 모두 시험해 갈랐다 — 빌드 로그로는 못 갈랐다.)
 *
 * 🛑 그런데 그 자리를 `catch {}` 가 조용히 삼키고 있었다. 그래서:
 *   - 빌드는 통과한다(에러가 로그로만 나간다)
 *   - `processingRequiredCount` 는 **항상 0** 이다 — 저재고·만료 임박이 한 건도 안 잡힌다
 *   - 화면은 "처리 필요 0" 을 **정상처럼** 보여준다
 *   오늘 하루 걷어낸 형태 그대로다 — 빌드는 통과하고 기능은 죽어 있다.
 *
 * 영향 화면(호출 그래프):
 *   `lib/dashboard/snapshot-helper.ts`
 *     → `api/cron/dashboard-snapshot`  (일일 스냅샷 캡처)
 *     → `api/dashboard/stats`          (최근 스냅샷 조회)
 *   즉 대시보드의 **처리 필요** 지표가 조직 스코프에서 죽어 있었다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const HELPER = "src/lib/dashboard/snapshot-helper.ts";

describe("§snapshot-lowstock-throw — 없는 필드로 거르지 않는다", () => {
  it("🛑 `Product` 를 통해 organizationId 로 거르는 자리가 **저장소 전량**에 0이다", () => {
    /* 이 파일만 고치면 형제 슬롯이 남는다(4원칙 ⑤). 축을 소스 전체로 연다.
     * 🔑 `ProductInventory.product` 처럼 nullable 인 to-one 관계는 전부 같은 형태다 —
     *   지금은 이 한 곳뿐이지만, 새로 생기면 여기서 잡힌다. */
    const hits: string[] = [];
    (function walk(dir: string) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name === "node_modules" || e.name === "__tests__") continue;
          walk(p);
        } else if (/\.tsx?$/.test(e.name)) {
          const code = stripComments(readFileSync(p, "utf8"));
          if (/product:\s*\{\s*organizationId\s*\}/.test(code)) {
            hits.push(p.slice(p.indexOf("src")).replace(/\\/g, "/"));
          }
        }
      }
    })(join(WEB_ROOT, "src"));
    expect(
      hits,
      `Product 에 없는 organizationId 로 거른 자리: ${hits.join(" · ")}`,
    ).toHaveLength(0);
  });

  it("스냅샷 헬퍼가 **자기 열** organizationId 를 쓴다 (두 자리 모두)", () => {
    /* 경로는 OR 로 묶지 않는다 — 저재고와 만료 임박이 각각 별개 집계다. */
    const code = stripComments(read(HELPER));
    /* 🔑 정규식 대신 문자열 계수 — 이 형태는 이스케이프가 많아 정규식이 오히려 약해진다
     *   (2026-09-10 실측: heredoc 이 `\.` 를 접어 매칭 0이 됐고, 그 0이 "구현이 없다" 로 읽혔다). */
    const NEEDLE = "...(organizationId ? { organizationId } : {})";
    const uses = code.split(NEEDLE).length - 1;
    expect(uses).toBe(2);
  });

  it("🛑 실패를 조용히 삼키지 않는다 (catch 전량이 사유를 남긴다)", () => {
    /* 이 결함이 오래 숨은 직접 원인이 `catch {}` 였다.
     * 빈 catch 가 하나라도 남으면 다음 결함도 같은 방식으로 숨는다. */
    const code = stripComments(read(HELPER));
    expect(code).not.toMatch(/\}\s*catch\s*\{\s*\}/);
    expect(code).not.toMatch(/\}\s*catch\s*\{\s*$/m);
    const logs = code.match(/console\.error\("\[dashboard-snapshot\]/g) ?? [];
    expect(logs.length).toBeGreaterThanOrEqual(4);
  });

  it("🔑 fallback 은 유지한다 — 한 집계가 실패해도 나머지는 계속 잡는다 (회귀 0)", () => {
    /* 기록하게 만드느라 throw 로 바꾸면 스냅샷 1건 실패가 전체를 죽인다.
     * 명제는 "조용히 삼키지 않는다" 이지 "실패를 전파한다" 가 아니다. */
    const code = stripComments(read(HELPER));
    expect(code).toMatch(/let processingRequiredCount = 0;/);
    expect(code).not.toMatch(/catch[\s\S]{0,300}?throw /);
  });
});

