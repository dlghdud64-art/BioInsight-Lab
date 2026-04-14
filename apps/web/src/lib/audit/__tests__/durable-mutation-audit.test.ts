/**
 * Batch 6: Durable Mutation Audit Sink — Contract Tests
 *
 * 검증 시나리오:
 * 1. audit event key 생성 규칙
 * 2. recordMutationAudit 정상 기록
 * 3. 중복 auditEventKey → idempotent skip (P2002)
 * 4. DB 에러 전파 (치명적 에러)
 * 5. 6개 우선 route의 wiring 계약
 * 6. event shape 필수 필드 검증
 * 7. compensatingForEventId 연결성
 */

import {
  buildAuditEventKey,
  recordMutationAudit,
  type DurableMutationAuditInput,
} from '../durable-mutation-audit';

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function createMockTx() {
  const records: Record<string, unknown>[] = [];

  return {
    records,
    mutationAuditEvent: {
      create: async (args: { data: Record<string, unknown> }) => {
        const existing = records.find(
          (r) => r.auditEventKey === args.data.auditEventKey,
        );
        if (existing) {
          const error = new Error('Unique constraint violation') as any;
          error.code = 'P2002';
          throw error;
        }
        const row = { id: `cuid_${records.length}`, ...args.data };
        records.push(row);
        return row;
      },
    },
  };
}

function baseInput(overrides?: Partial<DurableMutationAuditInput>): DurableMutationAuditInput {
  return {
    auditEventKey: buildAuditEventKey('org-1', 'req-abc', 'purchase_request_approve'),
    orgId: 'org-1',
    actorId: 'user-1',
    route: '/api/request/[id]/approve',
    action: 'purchase_request_approve',
    entityType: 'purchase_request',
    entityId: 'req-abc',
    result: 'success',
    correlationId: 'corr-001',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// 1. Audit Event Key 생성 규칙
// ═══════════════════════════════════════════════════════

describe('buildAuditEventKey', () => {
  test('표준 형식: orgId:entityId:action:suffix', () => {
    const key = buildAuditEventKey('org-1', 'req-abc', 'purchase_request_approve', 'cat-1');
    expect(key).toBe('org-1:req-abc:purchase_request_approve:cat-1');
  });

  test('suffix 기본값은 "1"', () => {
    const key = buildAuditEventKey('org-1', 'req-abc', 'purchase_request_approve');
    expect(key).toBe('org-1:req-abc:purchase_request_approve:1');
  });

  test('같은 입력 → 같은 키 (결정론적)', () => {
    const k1 = buildAuditEventKey('org-1', 'entity-1', 'approve', 'suffix-a');
    const k2 = buildAuditEventKey('org-1', 'entity-1', 'approve', 'suffix-a');
    expect(k1).toBe(k2);
  });

  test('다른 action → 다른 키', () => {
    const k1 = buildAuditEventKey('org-1', 'entity-1', 'approve');
    const k2 = buildAuditEventKey('org-1', 'entity-1', 'cancel');
    expect(k1).not.toBe(k2);
  });
});

// ═══════════════════════════════════════════════════════
// 2. recordMutationAudit 정상 기록
// ═══════════════════════════════════════════════════════

describe('recordMutationAudit', () => {
  test('정상 기록 → true 반환, row 생성', async () => {
    const tx = createMockTx();
    const result = await recordMutationAudit(tx, baseInput());

    expect(result).toBe(true);
    expect(tx.records).toHaveLength(1);
    expect(tx.records[0].auditEventKey).toBe(
      'org-1:req-abc:purchase_request_approve:1',
    );
    expect(tx.records[0].action).toBe('purchase_request_approve');
    expect(tx.records[0].result).toBe('success');
    expect(tx.records[0].orgId).toBe('org-1');
    expect(tx.records[0].actorId).toBe('user-1');
  });

  // ═══════════════════════════════════════════════════════
  // 3. 중복 auditEventKey → idempotent skip
  // ═══════════════════════════════════════════════════════

  test('동일 auditEventKey 재실행 → false (idempotent skip), 중복 증식 없음', async () => {
    const tx = createMockTx();
    const input = baseInput();

    const first = await recordMutationAudit(tx, input);
    expect(first).toBe(true);
    expect(tx.records).toHaveLength(1);

    const second = await recordMutationAudit(tx, input);
    expect(second).toBe(false);
    expect(tx.records).toHaveLength(1); // 중복 증식 없음
  });

  // ═══════════════════════════════════════════════════════
  // 4. DB 에러 전파
  // ═══════════════════════════════════════════════════════

  test('P2002 외 에러는 throw', async () => {
    const tx = {
      mutationAuditEvent: {
        create: async () => {
          const error = new Error('Connection refused') as any;
          error.code = 'P1001';
          throw error;
        },
      },
    };

    await expect(recordMutationAudit(tx, baseInput())).rejects.toThrow('Connection refused');
  });
});

// ═══════════════════════════════════════════════════════
// 5. 6개 우선 route의 wiring 계약
// ═══════════════════════════════════════════════════════

describe('6개 route wiring 계약', () => {
  const ROUTES = [
    {
      name: 'approve',
      action: 'purchase_request_approve',
      route: '/api/request/[id]/approve',
      entityType: 'purchase_request',
    },
    {
      name: 'cancel',
      action: 'purchase_request_cancel',
      route: '/api/request/[id]/cancel',
      entityType: 'purchase_request',
    },
    {
      name: 'reverse',
      action: 'purchase_request_reverse',
      route: '/api/request/[id]/reverse',
      entityType: 'purchase_request',
    },
    {
      name: 'po_void',
      action: 'order_cancelled_po_void',
      route: '/api/admin/orders/[id]/status',
      entityType: 'order',
    },
    {
      name: 'reclass',
      action: 'purchase_record_reclass',
      route: '/api/purchases/[id]/reclass',
      entityType: 'purchase_record',
    },
    {
      name: 'invites/accept',
      action: 'workspace_invite_accept',
      route: '/api/invites/accept',
      entityType: 'invite',
    },
  ];

  test.each(ROUTES)(
    '$name route → action=$action, route=$route, entityType=$entityType 기록 가능',
    async ({ action, route, entityType }) => {
      const tx = createMockTx();
      const result = await recordMutationAudit(tx, baseInput({
        auditEventKey: buildAuditEventKey('org-1', 'ent-1', action),
        action,
        route,
        entityType,
        entityId: 'ent-1',
      }));

      expect(result).toBe(true);
      expect(tx.records[0].action).toBe(action);
      expect(tx.records[0].route).toBe(route);
      expect(tx.records[0].entityType).toBe(entityType);
    },
  );
});

// ═══════════════════════════════════════════════════════
// 6. Event shape 필수 필드 검증
// ═══════════════════════════════════════════════════════

describe('event shape 필수 필드', () => {
  test('모든 필수 필드가 DB row에 기록됨', async () => {
    const tx = createMockTx();
    const input = baseInput({
      requestId: 'req-abc',
      orderId: 'ord-123',
      periodKey: 'org-1:cat-1:2026-04',
      normalizedCategoryId: 'cat-1',
      amount: 150000,
      thresholds: { warningPercent: 70, softLimitPercent: 90, hardStopPercent: 100 },
      decisionBasis: [{ level: 'ok', projectedUsagePercent: 45 }],
      budgetEventKey: 'org-1:req-abc:approval_reserved:cat-1',
    });

    await recordMutationAudit(tx, input);
    const row = tx.records[0];

    // 필수 core 필드
    expect(row.auditEventKey).toBeTruthy();
    expect(row.orgId).toBe('org-1');
    expect(row.actorId).toBe('user-1');
    expect(row.route).toBe('/api/request/[id]/approve');
    expect(row.action).toBe('purchase_request_approve');
    expect(row.entityType).toBe('purchase_request');
    expect(row.entityId).toBe('req-abc');
    expect(row.result).toBe('success');
    expect(row.correlationId).toBe('corr-001');

    // domain-specific context 필드
    expect(row.requestId).toBe('req-abc');
    expect(row.orderId).toBe('ord-123');
    expect(row.periodKey).toBe('org-1:cat-1:2026-04');
    expect(row.normalizedCategoryId).toBe('cat-1');
    expect(row.amount).toBe(150000);
    expect(row.thresholds).toEqual({ warningPercent: 70, softLimitPercent: 90, hardStopPercent: 100 });
    expect(row.decisionBasis).toEqual([{ level: 'ok', projectedUsagePercent: 45 }]);
    expect(row.budgetEventKey).toBe('org-1:req-abc:approval_reserved:cat-1');
  });

  test('optional 필드 미제공 시 null 기록', async () => {
    const tx = createMockTx();
    await recordMutationAudit(tx, baseInput());
    const row = tx.records[0];

    expect(row.requestId).toBeNull();
    expect(row.orderId).toBeNull();
    expect(row.purchaseRecordId).toBeNull();
    expect(row.periodKey).toBeNull();
    expect(row.normalizedCategoryId).toBeNull();
    expect(row.amount).toBeNull();
    expect(row.thresholds).toBeNull();
    expect(row.decisionBasis).toBeNull();
    expect(row.budgetEventKey).toBeNull();
    expect(row.compensatingForEventId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// 7. compensatingForEventId 연결성
// ═══════════════════════════════════════════════════════

describe('compensatingForEventId', () => {
  test('reverse는 원본 approve auditEventKey를 참조', async () => {
    const tx = createMockTx();

    // 원본 approve
    const approveKey = buildAuditEventKey('org-1', 'req-abc', 'purchase_request_approve');
    await recordMutationAudit(tx, baseInput({
      auditEventKey: approveKey,
      action: 'purchase_request_approve',
    }));

    // reverse — compensatingForEventId로 원본 참조
    const reverseKey = buildAuditEventKey('org-1', 'req-abc', 'purchase_request_reverse');
    await recordMutationAudit(tx, baseInput({
      auditEventKey: reverseKey,
      action: 'purchase_request_reverse',
      route: '/api/request/[id]/reverse',
      compensatingForEventId: approveKey,
    }));

    expect(tx.records).toHaveLength(2);
    expect(tx.records[1].compensatingForEventId).toBe(approveKey);
    expect(tx.records[1].action).toBe('purchase_request_reverse');
  });

  test('po_void는 원본 approve auditEventKey를 참조', async () => {
    const tx = createMockTx();

    const approveKey = buildAuditEventKey('org-1', 'req-abc', 'purchase_request_approve');
    const voidKey = buildAuditEventKey('org-1', 'ord-123', 'order_cancelled_po_void');

    await recordMutationAudit(tx, baseInput({
      auditEventKey: voidKey,
      action: 'order_cancelled_po_void',
      entityType: 'order',
      entityId: 'ord-123',
      route: '/api/admin/orders/[id]/status',
      compensatingForEventId: approveKey,
    }));

    expect(tx.records[0].compensatingForEventId).toBe(approveKey);
  });
});

// ═══════════════════════════════════════════════════════
// 8. 운영자 재구성 가능성 검증
// ═══════════════════════════════════════════════════════

describe('운영자 재구성 — "누가 / 무엇을 / 언제 / 어떤 근거로 / 얼마를"', () => {
  test('approve event에서 5W 재구성 가능', async () => {
    const tx = createMockTx();
    await recordMutationAudit(tx, baseInput({
      requestId: 'req-abc',
      amount: 250000,
      normalizedCategoryId: 'cat-reagents',
      periodKey: 'org-1:cat-reagents:2026-04',
      thresholds: { warningPercent: 70, softLimitPercent: 90, hardStopPercent: 100 },
      decisionBasis: [{
        categoryId: 'cat-reagents',
        projectedUsagePercent: 65,
        level: 'ok',
        preCommitCommitted: 500000,
        requestedAmount: 250000,
        postCommitCommitted: 750000,
        budgetAmount: 1200000,
      }],
    }));

    const row = tx.records[0];

    // 누가
    expect(row.actorId).toBe('user-1');
    // 무엇을
    expect(row.action).toBe('purchase_request_approve');
    expect(row.entityType).toBe('purchase_request');
    expect(row.entityId).toBe('req-abc');
    // 언제
    expect(row.occurredAt).toBeInstanceOf(Date);
    // 어떤 근거로
    expect(row.decisionBasis).toBeTruthy();
    const basis = (row.decisionBasis as any[])[0];
    expect(basis.projectedUsagePercent).toBe(65);
    expect(basis.level).toBe('ok');
    // 얼마를
    expect(row.amount).toBe(250000);
    expect(row.normalizedCategoryId).toBe('cat-reagents');
  });
});
