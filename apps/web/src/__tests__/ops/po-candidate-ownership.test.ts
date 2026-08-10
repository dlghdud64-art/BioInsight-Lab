/**
 * §po-candidate-idor — POCandidate 쓰기는 소유자 범위를 벗어나지 않는다
 *
 * 배경 (2026-08-10 §enforcement-handle-close-sweep 배치12 부수 관측):
 *   `deletePOCandidate(id)` 가 `prisma.pOCandidate.delete({ where: { id } })` 만
 *   수행했고 라우트에도 소유권 검증이 없었다. 로그인한 사용자면 누구나 id 만 알면
 *   남의 발주 후보를 지울 수 있었다. `updatePOCandidateStage` 도 동일했다.
 *
 *   발주 후보는 구매 흐름의 진입점이라, 삭제되면 사용자는 "내가 만든 게 사라졌다"
 *   만 보고 원인에 도달할 경로가 없다.
 *
 * 계약:
 *   P1. 쓰기 helper 의 `where` 에 id 단독이 오지 않는다 — 반드시 userId 로 좁힌다.
 *   P2. 소유권 검증은 **라우트가 아니라 helper** 에 있다. 라우트에만 두면
 *       다른 호출자가 생길 때 같은 구멍이 재발한다.
 *   P3. actorUserId 는 필수 인자다 — 호출자가 빠뜨리면 컴파일이 깨진다.
 *   P4. 남의 후보/없는 후보는 404 이며 그 경로에서 쓰기가 없다.
 *   P5. PATCH/DELETE 는 enforceAction 으로 집행된다 (§enforcement-coverage-gap).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

/** 주석 제거본에 부정 단언을 건다 — 설명 주석이 스스로를 매칭하지 않도록 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const HELPER = "src/lib/persistence/po-candidate-server.ts";
const ROUTE = "src/app/api/po-candidates/route.ts";

describe("§po-candidate-idor P1/P2/P3 — helper 가 소유자 범위를 강제한다", () => {
  it("P1. 쓰기 where 에 id 단독이 오지 않는다", () => {
    const code = stripComments(read(HELPER));
    // `where: { id }` / `where: { id: <something> }` 단독 형태 금지 (쓰기 계열)
    expect(code).not.toMatch(/pOCandidate\.delete\s*\(\s*\{\s*where:\s*\{\s*id\s*\}/);
    expect(code).not.toMatch(/pOCandidate\.update\s*\(\s*\{\s*where:\s*\{\s*id\s*\}/);
    expect(code).not.toMatch(/pOCandidate\.deleteMany\s*\(\s*\{\s*where:\s*\{\s*id\s*\}\s*\}/);
  });

  it("P1-b. delete/update 는 { id, userId } 로 좁힌다", () => {
    const code = stripComments(read(HELPER));
    expect(code).toMatch(/pOCandidate\.deleteMany\s*\(\s*\{[\s\S]{0,120}?where:\s*\{\s*id,\s*userId:\s*actorUserId\s*\}/);
    expect(code).toMatch(/pOCandidate\.updateMany\s*\(\s*\{[\s\S]{0,120}?where:\s*\{\s*id,\s*userId:\s*actorUserId\s*\}/);
  });

  it("P2/P3. 쓰기 helper 3종이 actorUserId 를 필수 인자로 받는다", () => {
    const code = stripComments(read(HELPER));
    expect(code).toMatch(/export async function getPOCandidate\([\s\S]{0,160}?actorUserId:\s*string,/);
    expect(code).toMatch(/export async function updatePOCandidateStage\([\s\S]{0,160}?actorUserId:\s*string,/);
    expect(code).toMatch(/export async function deletePOCandidate\(\s*id:\s*string,\s*actorUserId:\s*string\s*\)/);
  });

  it("P2-b. 단건 조회도 소유자 범위다", () => {
    const code = stripComments(read(HELPER));
    expect(code).not.toMatch(/pOCandidate\.findUnique\s*\(\s*\{\s*where:\s*\{\s*id\s*\}/);
  });
});

describe("§po-candidate-idor P4/P5 — 라우트 계약", () => {
  it("P4. PATCH/DELETE 는 helper 에 세션 사용자 id 를 넘긴다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/updatePOCandidateStage\(\s*id,\s*session\.user\.id,/);
    expect(code).toMatch(/deletePOCandidate\(\s*id,\s*session\.user\.id\s*\)/);
  });

  it("P4-b. 소유자가 아니면 404 (존재 여부를 노출하지 않는다)", () => {
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/if\s*\(!updated\)[\s\S]{0,200}?status:\s*404/);
    expect(code).toMatch(/if\s*\(!deleted\)[\s\S]{0,200}?status:\s*404/);
  });

  it("P5. PATCH/DELETE 도 enforceAction 으로 집행된다", () => {
    const code = stripComments(read(ROUTE));
    // POST 1 + PATCH 1 + DELETE 1 = 3
    const count = (code.match(/enforceAction\(\{/g) ?? []).length;
    expect(count).toBe(3);
    expect(code).toMatch(/action:\s*'sensitive_data_delete'/);
  });
});
