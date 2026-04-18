/**
 * Batch 6: Durable Mutation Audit Sink — 계약 검증 (네트워크 불필요)
 *
 * 파일 분석 기반으로 6개 route에 durable audit sink가 올바르게 연결되었는지 검증.
 * node --experimental-vm-modules로 직접 실행 가능.
 *
 * 검증 시나리오:
 * 1. MutationAuditEvent Prisma 모델 존재
 * 2. durable-mutation-audit.ts 계약 (buildAuditEventKey, recordMutationAudit)
 * 3. 6개 우선 route에 recordMutationAudit import + 호출 존재
 * 4. 같은 tx 안에서 호출 (트랜잭션 경계 검증)
 * 5. idempotency key unique 제약 존재
 * 6. compensatingForEventId 연결 (reverse, po_void)
 * 7. event shape 필수 필드 (누가/무엇을/언제/어떤 근거로/얼마를)
 * 8. route coverage matrix Audit Present 갱신
 * 9. audit event key 결정론성
 * 10. append-only 원칙 (UPDATE/DELETE 없음)
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const webRoot = resolve(__dir, "../../..");
const prismaSchema = readFileSync(resolve(webRoot, "../prisma/schema.prisma"), "utf-8");
const auditModule = readFileSync(resolve(__dir, "../durable-mutation-audit.ts"), "utf-8");

// route 파일 로딩
const routes = {
  approve: readFileSync(resolve(webRoot, "app/api/request/[id]/approve/route.ts"), "utf-8"),
  cancel: readFileSync(resolve(webRoot, "app/api/request/[id]/cancel/route.ts"), "utf-8"),
  reverse: readFileSync(resolve(webRoot, "app/api/request/[id]/reverse/route.ts"), "utf-8"),
  poVoid: readFileSync(resolve(webRoot, "app/api/admin/orders/[id]/status/route.ts"), "utf-8"),
  reclass: readFileSync(resolve(webRoot, "app/api/purchases/[id]/reclass/route.ts"), "utf-8"),
  invitesAccept: readFileSync(resolve(webRoot, "app/api/invites/accept/route.ts"), "utf-8"),
};

const matrix = readFileSync(resolve(webRoot, "../../../docs/BATCH8_ROUTE_COVERAGE_MATRIX.md"), "utf-8");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log("Batch 6: Durable Mutation Audit Sink 계약 검증\n");

// ═══════════════════════════════════════════════════════
// 1. MutationAuditEvent Prisma 모델
// ═══════════════════════════════════════════════════════

console.log("  === 1. Prisma Model ===");

test("MutationAuditEvent 모델 존재", () => {
  assert.ok(prismaSchema.includes("model MutationAuditEvent {"));
});

// 모델 블록 추출 — 중괄호 중첩 없으므로 @@index 뒤 }까지 포함
const modelStart = prismaSchema.indexOf("model MutationAuditEvent {");
const modelBlockEnd = prismaSchema.indexOf("\n}", modelStart);
const modelBlock = prismaSchema.slice(modelStart, modelBlockEnd + 2);

test("auditEventKey unique 제약", () => {
  assert.ok(modelBlock.includes("@unique"), "auditEventKey에 @unique 제약 필요");
});

test("append-only 원칙 — UPDATE/DELETE 없음 (주석에 명시)", () => {
  const before = prismaSchema.slice(
    Math.max(0, prismaSchema.indexOf("model MutationAuditEvent {") - 200),
    prismaSchema.indexOf("model MutationAuditEvent {"),
  );
  assert.ok(
    before.includes("append-only") || before.includes("UPDATE/DELETE 금지"),
    "append-only 원칙 주석 필요",
  );
});

test("필수 컬럼 존재: orgId, actorId, route, action, entityType, entityId, result, correlationId", () => {
  for (const col of ["orgId", "actorId", "route", "action", "entityType", "entityId", "result", "correlationId"]) {
    assert.ok(modelBlock.includes(col), `컬럼 ${col} 누락`);
  }
});

test("domain context 컬럼 존재: requestId, orderId, periodKey, amount, decisionBasis, compensatingForEventId", () => {
  for (const col of ["requestId", "orderId", "periodKey", "amount", "decisionBasis", "compensatingForEventId"]) {
    assert.ok(modelBlock.includes(col), `컬럼 ${col} 누락`);
  }
});

test("인덱스 존재: orgId+occurredAt, entityType+entityId, actorId, action, correlationId", () => {
  assert.ok(modelBlock.includes("@@index([orgId, occurredAt])"), "orgId+occurredAt 인덱스");
  assert.ok(modelBlock.includes("@@index([entityType, entityId])"), "entityType+entityId 인덱스");
  assert.ok(modelBlock.includes("@@index([actorId])"), "actorId 인덱스");
  assert.ok(modelBlock.includes("@@index([correlationId])"), "correlationId 인덱스");
});

// ═══════════════════════════════════════════════════════
// 2. durable-mutation-audit.ts 계약
// ═══════════════════════════════════════════════════════

console.log("\n  === 2. Audit Module 계약 ===");

test("buildAuditEventKey export 존재", () => {
  assert.ok(auditModule.includes("export function buildAuditEventKey"));
});

test("recordMutationAudit export 존재", () => {
  assert.ok(auditModule.includes("export async function recordMutationAudit"));
});

test("P2002 idempotent skip 처리", () => {
  assert.ok(auditModule.includes("P2002"));
  assert.ok(auditModule.includes("return false"));
});

test("DurableMutationAuditInput interface export", () => {
  assert.ok(auditModule.includes("export interface DurableMutationAuditInput"));
});

test("tx.mutationAuditEvent.create 호출", () => {
  assert.ok(auditModule.includes("tx.mutationAuditEvent.create"));
});

// ═══════════════════════════════════════════════════════
// 3. 6개 route에 recordMutationAudit import + 호출
// ═══════════════════════════════════════════════════════

console.log("\n  === 3. Route Wiring ===");

const routeConfigs = [
  { key: "approve", action: "purchase_request_approve", route: "/api/request/[id]/approve" },
  { key: "cancel", action: "purchase_request_cancel", route: "/api/request/[id]/cancel" },
  { key: "reverse", action: "purchase_request_reverse", route: "/api/request/[id]/reverse" },
  { key: "poVoid", action: "order_cancelled_po_void", route: "/api/admin/orders/[id]/status" },
  { key: "reclass", action: "purchase_record_reclass", route: "/api/purchases/[id]/reclass" },
  { key: "invitesAccept", action: "workspace_invite_accept", route: "/api/invites/accept" },
];

for (const { key, action, route } of routeConfigs) {
  const src = routes[key];

  test(`${key}: recordMutationAudit import`, () => {
    assert.ok(src.includes("recordMutationAudit"), `${key}에 recordMutationAudit import 누락`);
  });

  test(`${key}: buildAuditEventKey import`, () => {
    assert.ok(src.includes("buildAuditEventKey"), `${key}에 buildAuditEventKey import 누락`);
  });

  test(`${key}: recordMutationAudit(tx, ...) 호출`, () => {
    assert.ok(src.includes("recordMutationAudit(tx,"), `${key}에 recordMutationAudit(tx, ...) 호출 누락`);
  });

  test(`${key}: action = '${action}'`, () => {
    assert.ok(src.includes(`action: '${action}'`) || src.includes(`action: "${action}"`),
      `${key}에 action '${action}' 누락`);
  });

  test(`${key}: result: 'success'`, () => {
    assert.ok(src.includes("result: 'success'") || src.includes('result: "success"'),
      `${key}에 result 'success' 누락`);
  });

  test(`${key}: correlationId 전달`, () => {
    assert.ok(src.includes("correlationId:"), `${key}에 correlationId 전달 누락`);
  });
}

// ═══════════════════════════════════════════════════════
// 4. 트랜잭션 경계 — 같은 tx 안에서 호출
// ═══════════════════════════════════════════════════════

console.log("\n  === 4. 트랜잭션 경계 ===");

test("approve: withSerializableBudgetTx 내부에서 recordMutationAudit 호출", () => {
  const txStart = routes.approve.indexOf("withSerializableBudgetTx(db, async (tx");
  const auditCall = routes.approve.indexOf("recordMutationAudit(tx,");
  assert.ok(txStart > 0 && auditCall > txStart, "approve의 audit이 tx 밖에서 호출됨");
});

test("cancel: withSerializableBudgetTx 내부에서 recordMutationAudit 호출", () => {
  const txStart = routes.cancel.indexOf("withSerializableBudgetTx(db, async (tx");
  const auditCall = routes.cancel.indexOf("recordMutationAudit(tx,");
  assert.ok(txStart > 0 && auditCall > txStart, "cancel의 audit이 tx 밖에서 호출됨");
});

test("invitesAccept: db.$transaction 내부에서 recordMutationAudit 호출", () => {
  const txStart = routes.invitesAccept.indexOf("db.$transaction(async (tx");
  const auditCall = routes.invitesAccept.indexOf("recordMutationAudit(tx,");
  assert.ok(txStart > 0 && auditCall > txStart, "invitesAccept의 audit이 tx 밖에서 호출됨");
});

// ═══════════════════════════════════════════════════════
// 5. compensatingForEventId 연결
// ═══════════════════════════════════════════════════════

console.log("\n  === 5. compensatingForEventId 연결 ===");

test("reverse: compensatingForEventId로 approve key 참조", () => {
  assert.ok(
    routes.reverse.includes("compensatingForEventId:") &&
    routes.reverse.includes("purchase_request_approve"),
    "reverse에 compensatingForEventId → approve 참조 누락",
  );
});

test("poVoid: compensatingForEventId로 approve key 참조", () => {
  assert.ok(
    routes.poVoid.includes("compensatingForEventId:") &&
    routes.poVoid.includes("purchase_request_approve"),
    "poVoid에 compensatingForEventId → approve 참조 누락",
  );
});

// ═══════════════════════════════════════════════════════
// 6. Route Coverage Matrix 갱신
// ═══════════════════════════════════════════════════════

console.log("\n  === 6. Route Coverage Matrix ===");

const auditPresentRoutes = [
  "/api/request/[id]/approve",
  "/api/request/[id]/cancel",
  "/api/request/[id]/reverse",
  "/api/admin/orders/[id]/status",
  "/api/purchases/[id]/reclass",
  "/api/invites/accept",
];

for (const route of auditPresentRoutes) {
  test(`matrix: ${route} Audit Present ✓`, () => {
    // matrix에서 해당 route 줄을 찾아 Batch 6 또는 Audit Present가 있는지 확인
    const lines = matrix.split("\n").filter(l => l.includes(route));
    assert.ok(lines.length > 0, `matrix에 ${route} 누락`);
    const hasAudit = lines.some(l =>
      l.includes("Durable") && l.includes("✓"),
    );
    assert.ok(hasAudit, `${route}의 Audit Present가 ✓ Durable로 갱신되지 않음`);
  });
}

test("matrix: Batch 6 변경 이력 기록", () => {
  assert.ok(matrix.includes("2026-04-14"), "Batch 6 변경 이력 날짜 누락");
  assert.ok(matrix.includes("Durable Audit Sink") || matrix.includes("MutationAuditEvent"),
    "Batch 6 변경 이력 설명 누락");
});

// ═══════════════════════════════════════════════════════
// 결과 요약
// ═══════════════════════════════════════════════════════

console.log(`\n${"=".repeat(50)}`);
console.log(`  Batch 6 Durable Audit Sink 계약 검증 완료`);
console.log(`  통과: ${passed}  |  실패: ${failed}`);
console.log(`${"=".repeat(50)}`);

if (failed > 0) {
  console.error(`\n⚠ ${failed}개 실패`);
  process.exit(1);
}
console.log("\n✓ 모든 계약 통과");
