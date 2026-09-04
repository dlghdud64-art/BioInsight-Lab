/**
 * §11.309c #smart-receiving-api — Regression sentinel
 *
 * route 파일 존재 + 핵심 패턴 강제:
 *   - POST handler export
 *   - auth() 미들웨어
 *   - enforceAction("inventory_smart_receiving")
 *   - db.$transaction 원자성
 *   - 기존 분기 (inventoryId) + 신규 분기 (Product create)
 *   - §11.309a 새 필드 (ocrJobId + extractedData) 사용
 *   - createAuditLog (INVENTORY_RESTOCK CREATE)
 *   - 입력 validation (ocrJobId / quantity / productName)
 *   - multi-tenant 격리 (ocrJob organization match)
 */

import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const ROUTE_PATH = "src/app/api/inventory/smart-receiving/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.309c — route 파일 존재 + 패턴", () => {
  it("route 파일 존재", () => {
    expect(existsSync(join(REPO_ROOT, ROUTE_PATH))).toBe(true);
  });

  it("POST handler export", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("auth() 미들웨어 호출 + 401 분기", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/await\s+auth\(\)/);
    expect(src).toMatch(/Unauthorized.*401/);
  });

  it("§11.309c-hotfix-2 — enforceAction 제거 (단순화, enum 미등록)", () => {
    const src = read(ROUTE_PATH);
    // enforceAction 호출 0 — auth() + DataAuditLog 만 사용
    expect(src).not.toMatch(/enforceAction\(/);
    expect(src).not.toMatch(/enforcement\./);
    // import 도 제거
    expect(src).not.toMatch(/from\s+["']@\/lib\/security\/server-enforcement-middleware["']/);
  });
});

describe("§11.309c — 입력 validation", () => {
  it("ocrJobId 필수 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/ocrJobId는 필수입니다/);
    expect(src).toMatch(/!ocrJobId\s*\|\|\s*typeof\s+ocrJobId\s*!==\s*["']string["']/);
  });

  it("quantity > 0 검증 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/confirmedData\.quantity는 0보다 큰 숫자여야 합니다/);
    expect(src).toMatch(/confirmedData\.quantity\s*<=\s*0/);
  });

  it("신규 시 productName 필수 (없으면 400)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/productName이 필수입니다/);
  });
});

describe("§11.309c — OcrJob multi-tenant 격리", () => {
  it("OcrJob 존재 검증 (없으면 404)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.ocrJob\.findUnique/);
    expect(src).toMatch(/ocrJob을 찾을 수 없습니다/);
  });

  // 🛑 은퇴+승계(§scan-org-identity 2026-09-04). 구 판본은 `ocrOrgMatches` ·
  //   `ocrOwnerMatches` · `organizationMember.findFirst` 라는 **구현 이름 3개**를 잠갔다.
  //   그 구현이 실제로 한 일은 `ocrJob.organizationId === organizationId` 비교였는데,
  //   OCR 라우트 5곳이 그 필드에 session.user.id 를 써 와서 **조직끼리가 아니라
  //   조직 자리의 userId 끼리** 비교하고 있었다(prod 실측: 그 id 의 Organization 실재 안 함).
  //   즉 이 단언은 성립한 적 없는 격리를 GREEN 으로 지켜줬다.
  //   승계: 의도("남의 OcrJob 으로 입고를 등록할 수 없다")는 불변이며, 지금은 더 엄격한
  //   소유자 단독 게이트로 잠근다. 조직 축 복원은 §scan-org-identity B 배치.
  it("남의 OcrJob 으로 등록할 수 없다 — 소유자 단독 게이트", () => {
    const src = read(ROUTE_PATH);
    const idx = src.indexOf("if (ocrJob.userId !== session.user.id) {");
    expect(idx).toBeGreaterThan(-1);
    expect(src.slice(idx, idx + 400)).toMatch(/status:\s*403/);
  });
});

describe("§11.309c — 분기 A (기존 inventoryId)", () => {
  it("ProductInventory.findUnique 권한 확인", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.productInventory\.findUnique[\s\S]*where:\s*\{\s*id:\s*inventoryId\s*\}/);
  });

  it("db.$transaction 안 currentQuantity increment", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/db\.\$transaction/);
    expect(src).toMatch(/currentQuantity:\s*\{\s*increment:\s*confirmedData\.quantity\s*\}/);
  });

  it("InventoryRestock create with ocrJobId + extractedData (§11.309a 정합)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/inventoryRestock\.create/);
    expect(src).toMatch(/ocrJobId,/);
    expect(src).toMatch(/extractedData:\s*confirmedData/);
  });

  it("createAuditLog INVENTORY_RESTOCK CREATE (기존 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/AuditAction\.CREATE/);
    expect(src).toMatch(/AuditEntityType\.INVENTORY_RESTOCK/);
    expect(src).toMatch(/source:\s*["']smart_receiving["']/);
  });

  it("isNew: false 응답 (기존 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/isNew:\s*false/);
  });
});

describe("§11.309c — 분기 B (신규 품목)", () => {
  it("Product create (name/brand/catalogNumber/category)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/tx\.product\.create/);
    expect(src).toMatch(/name:\s*confirmedData\.productName/);
    // 승계(§scan-registration-category 2026-09-04): DEFAULT_CATEGORY 상수 → 공용 resolver.
    //   의도(신규 Product 가 분류를 반드시 채운다)는 불변이므로 그 의도를 다시 잠근다.
    expect(src).toMatch(/category:\s*resolvedCategory\.category/);
    expect(src).toMatch(/categorySource:\s*resolvedCategory\.categorySource/);
  });

  it("ProductInventory create (productId + userId + initial quantity)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/tx\.productInventory\.create/);
    expect(src).toMatch(/productId:\s*product\.id/);
    expect(src).toMatch(/currentQuantity:\s*confirmedData\.quantity/);
  });

  it("InventoryRestock create (ocrJobId + extractedData) 신규 분기 포함", () => {
    const src = read(ROUTE_PATH);
    // 신규 분기 안에도 inventoryRestock.create 가 있어야 함
    const restocks = src.match(/inventoryRestock\.create/g);
    expect(restocks?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("isNew: true 응답 (신규 분기)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/isNew:\s*true/);
  });

  // 🛑 은퇴(2026-09-04) — 구 판본은 `DEFAULT_CATEGORY = "OTHER"` 를 **문자열로** 계약했다.
  //   prod enum 에 OTHER 가 없어서 신규 품목 등록이 100% 실패하는 동안 이 단언이 GREEN 을 지켜줬다.
  //   정적 문자열 검사가 런타임 전패를 승인한 형태다.
  //   승계: 규칙(신규 Product 의 분류는 **실재하는** enum 값이어야 한다)은 불변이며,
  //   §scan-registration-category 의 schema 대조 sentinel + 공용 모듈의
  //   `Record<ProductCategory, string>` 전수 강제로 잠근다(문자열 리터럴 계약 0).
  it("분류 상수를 문자열 리터럴로 캐스트해 만들지 않는다 (as 우회 차단)", () => {
    // 부정 단언은 주석 제거본에 — 이 결함을 설명한 주석이 스스로를 매칭한다.
    const src = stripComments(read(ROUTE_PATH));
    expect(src).not.toMatch(/["'][A-Z_]+["']\s+as\s+ProductCategory/);
    // 분류는 공용 resolver 로만 확정한다 — 라우트가 자기 기본값을 다시 만들지 않는다.
    expect(src).toMatch(
      /import \{ resolveProductCategory \} from "@\/lib\/inventory\/product-category-options"/,
    );
  });
});

describe("§11.309c — 의존성 import", () => {
  it("auth / db / Prisma / audit import (§11.309c-hotfix-2 enforcement-middleware 제거)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/from\s+["']@\/auth["']/);
    expect(src).toMatch(/from\s+["']@\/lib\/db["']/);
    expect(src).toMatch(/from\s+["']@prisma\/client["']/);
    expect(src).toMatch(/from\s+["']@\/lib\/audit["']/);
    // §11.309c-hotfix-2 — enforcement-middleware import 제거 확인
    expect(src).not.toMatch(/from\s+["']@\/lib\/security\/server-enforcement-middleware["']/);
  });

  // 🛑 은퇴+승계(§scan-registration-category 2026-09-04). 구 판본:
  //   toMatch(/ProductCategory.*from ...|import\s*\{[^}]*ProductCategory[^}]*\}/)
  //   라우트가 더는 enum 을 import 하지 않는데도 **통과했다** — `resolveProductCategory` 안에
  //   `ProductCategory` 가 부분 문자열로 들어 있어서다(정규식 4원칙 ① 접두사 포함).
  //   프로브 중 이 단언만 계속 GREEN 이라 드러났다. 죽은 주장을 정규식으로 살려두지 않고,
  //   지금의 진실(분류는 공용 resolver 로만 들어온다)로 승계한다.
  it("분류는 공용 resolver 경유 — 라우트가 enum 을 직접 들지 않는다 (경계 포함)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(
      /import \{ resolveProductCategory \} from "@\/lib\/inventory\/product-category-options"/,
    );
    // ① 경계 — `resolveProductCategory` 에 걸리지 않게 앞을 경계로 막는다.
    expect(stripComments(src)).not.toMatch(/[\s{,]ProductCategory[\s},]/);
  });
});
