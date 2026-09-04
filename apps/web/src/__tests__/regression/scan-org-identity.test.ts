/**
 * §scan-org-identity (호영님 2026-09-04, (C′)) — 조직의 권위 있는 출처는 **세션**이다.
 *
 * 사고:
 *   OCR 라우트 5곳이 `OcrJob.organizationId` 에 `session.user.id` 를 써 왔다
 *   (scan-label · ocr/correct · ocr/retry · quotes/parse-image · quotes/parse-pdf).
 *   OcrJob 쪽에는 FK 가 없어 DB 가 안 막았고, smart-receiving 이 그 값을
 *   `organizationId ?? ocrJob.organizationId` 로 승계해 ProductInventory 에 넣자
 *   FK 가 있는 그 자리에서 P2003 으로 터졌다.
 *   prod 실측: OcrJob.organizationId == userId · 그 id 의 Organization 실재하지 않음.
 *
 * 폐기한 것(보정이 아니라 폐기):
 *   `ocrJob.organizationId === organizationId` 격리 비교 — 조직끼리가 아니라
 *   **조직 자리의 userId 끼리** 비교하고 있었다. 격리 계약이 성립한 적이 없다.
 *
 * 잠그는 것:
 *   1) fallback 체인(`?? ocrJob.organizationId`) 부활 차단
 *   2) 조직은 resolveOrganizationIdForMutation 한 곳에서만 나온다
 *   3) 오염값을 null 로 삼키지 않는다 — 조직 없으면 422, hint 틀리면 403
 *   4) OcrJob 은 소유자 본인만 (조직 필드 정합 전까지)
 *   5) 신뢰하지 않기로 한 필드는 select 에서도 뺀다
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";

describe("§scan-org-identity — 조직은 세션에서만 나온다", () => {
  it("resolveOrganizationIdForMutation 을 실제로 쓴다 (hint 는 검증 대상일 뿐)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(
      /import \{ resolveOrganizationIdForMutation \} from "@\/lib\/organizations\/active-org"/,
    );
    const idx = src.indexOf("const orgResolution = await resolveOrganizationIdForMutation({");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 300);
    expect(win).toMatch(/userId:\s*session\.user\.id/);
    expect(win).toMatch(/hint:\s*organizationId \?\? null/);
  });

  it("두 쓰기 경로 모두 해석된 조직만 쓴다 (경로 각각)", () => {
    // ④ 경로는 OR 로 묶지 않는다 — 하나가 끊기는 것도 회귀다.
    const src = read(ROUTE);
    expect(src).toMatch(/const targetOrgIdMulti = targetOrganizationId;/);
    expect(src).toMatch(/const targetOrgId = targetOrganizationId;/);
  });

  it("🛑 fallback 체인 부활 차단 — ocrJob 의 조직 필드를 승계하지 않는다", () => {
    // 부정 단언은 주석 제거본에 — 이 결함을 설명한 주석이 스스로를 매칭한다.
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/\?\?\s*ocrJob\.organizationId/);
    expect(code).not.toMatch(/ocrJob\.organizationId/);
  });

  it("신뢰하지 않는 필드는 select 에서도 뺀다 (다시 쓰이는 경로 차단)", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("const ocrJob = await db.ocrJob.findUnique({");
    expect(idx).toBeGreaterThan(-1);
    const win = stripComments(src.slice(idx, idx + 600));
    expect(win).toMatch(/select:\s*\{[^}]*userId:\s*true/);
    expect(win).not.toMatch(/organizationId:\s*true/);
  });
});

describe("§scan-org-identity — 실패를 구분한다 (오염값을 삼키지 않는다)", () => {
  it("소속 조직 0 → 422 + 명시 사유 (개인 재고로 흘리지 않는다)", () => {
    const src = read(ROUTE);
    const idx = src.indexOf('code: "NO_ORGANIZATION"');
    expect(idx).toBeGreaterThan(-1);
    // 창은 분기 시작부터(② 창 시작점).
    const branch = src.indexOf("if (!orgResolution.ok) {");
    expect(branch).toBeGreaterThan(-1);
    const win = src.slice(branch, branch + 900);
    expect(win).toMatch(/status:\s*422/);
    expect(win).toMatch(/소속 조직이 없어 입고를 등록할 수 없습니다/);
  });

  it("hint 가 틀리면 403 — 조용히 활성 조직으로 갈아치우지 않는다", () => {
    const src = read(ROUTE);
    const branch = src.indexOf("if (!orgResolution.ok) {");
    const win = src.slice(branch, branch + 900);
    expect(win).toMatch(/hint_forbidden/);
    expect(win).toMatch(/code: "ORG_FORBIDDEN"/);
    expect(win).toMatch(/status:\s*403/);
  });

  it("두 실패가 같은 응답으로 뭉개지지 않는다 (코드 2종 · 상태 2종)", () => {
    const src = read(ROUTE);
    const branch = src.indexOf("if (!orgResolution.ok) {");
    const win = src.slice(branch, branch + 900);
    expect(win).toMatch(/ORG_FORBIDDEN/);
    expect(win).toMatch(/NO_ORGANIZATION/);
    expect(win).toMatch(/403/);
    expect(win).toMatch(/422/);
  });
});

describe("§scan-org-identity — OcrJob 접근은 소유자 본인만 (조직 필드 정합 전까지)", () => {
  it("소유자 아니면 403 + 명시 코드", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("if (ocrJob.userId !== session.user.id) {");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 400);
    expect(win).toMatch(/code: "OCRJOB_NOT_OWNED"/);
    expect(win).toMatch(/status:\s*403/);
  });

  it("🛑 폐기한 격리 비교가 부활하지 않는다 (조직 자리의 userId 끼리 비교였다)", () => {
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/ocrOrgMatches/);
    expect(code).not.toMatch(/ocrOwnerMatches/);
  });
});

describe("§scan-org-identity — 회귀 0", () => {
  it("기존 재고 매칭 경로(분기 A)의 스코프 검증은 그대로다", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/const isOwner = inventory\.userId === session\.user\.id/);
    expect(src).toMatch(/inventory\.organizationId/);
  });

  it("ocrJobId 미존재 404 · 미인증 401 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/ocrJob을 찾을 수 없습니다[\s\S]{0,120}?status:\s*404/);
    expect(src).toMatch(/Unauthorized[\s\S]{0,80}?status:\s*401/);
  });

  it("§scan-registration-category·reason 계약 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/categorySource:\s*resolvedCategory\.categorySource/);
    expect(src).toMatch(/categorySource:\s*lineCategory\.categorySource/);
    expect(src).toMatch(/failReason:\s*describeFailure\(error\)/);
  });
});
