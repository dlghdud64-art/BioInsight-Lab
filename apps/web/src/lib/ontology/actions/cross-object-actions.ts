/**
 * Cross-Object Atomic Actions — Phase 2
 *
 * 여러 Domain Object를 동시에 변경하는 원자적 비즈니스 액션.
 * 단일 Object CRUD가 아닌, 객체 간 관계를 존중하는 트랜잭션 단위.
 *
 * 규칙:
 * 1. 모든 cross-object action은 pre-condition → execute → post-condition 순서
 * 2. 부분 실패 시 전체 롤백 (optimistic unlock 금지)
 * 3. audit trace에 영향 받은 모든 객체 ID 기록
 * 4. Supabase RPC 또는 multi-table update로 원자성 보장
 */

import { supabase } from "@/lib/supabase";
import { evaluatePolicy } from "../policy";
import type {
  ActionResult,
  AuditTrace,
  PreconditionResult,
  PreconditionViolation,
} from "./index";

// ══════════════════════════════════════════════════════════════════════════════
// Common Helpers
// ══════════════════════════════════════════════════════════════════════════════

function buildAuditTrace(
  actionName: string,
  targetId: string,
  targetType: string,
  executedBy: string,
  transition?: { from: string; to: string },
): AuditTrace {
  return {
    actionName,
    executedAt: new Date().toISOString(),
    executedBy,
    targetObjectId: targetId,
    targetObjectType: targetType as any,
    snapshotBeforeId: null,
    snapshotAfterId: null,
    stateTransition: transition ?? null,
    preconditionSummary: "passed",
  };
}

function preconditionOk(): PreconditionResult {
  return { satisfied: true, violations: [] };
}

function preconditionFail(violations: PreconditionViolation[]): PreconditionResult {
  return { satisfied: false, violations };
}

// ══════════════════════════════════════════════════════════════════════════════
// FinalizeApproval — 주문 승인 + 예산 소진 업데이트 (atomic)
// ══════════════════════════════════════════════════════════════════════════════

export interface FinalizeApprovalInput {
  /** 승인 대상 주문 ID */
  orderId: string;
  /** 승인자 */
  approvedBy: string;
  /** 승인 코멘트 */
  approvalComment: string | null;
  /** 연결된 예산 ID (없으면 예산 차감 안 함) */
  budgetId: string | null;
  /** 주문 총액 (예산 차감 금액) */
  orderAmount: number;
}

export interface FinalizeApprovalOutput {
  /** 승인된 주문 ID */
  orderId: string;
  /** 새 주문 상태 */
  newStatus: string;
  /** 예산 업데이트 결과 */
  budgetUpdate: {
    budgetId: string;
    previousSpent: number;
    newSpent: number;
    newBurnRate: number;
  } | null;
  /** 다음 필요 액션 */
  nextAction: string;
}

/**
 * 승인 전 pre-condition 검증.
 * - 주문이 승인 대기 상태인지
 * - 예산 잔액이 충분한지
 * - 승인자가 요청자와 다른지 (SoD)
 */
export async function checkFinalizeApprovalPreconditions(
  input: FinalizeApprovalInput,
): Promise<PreconditionResult> {
  const violations: PreconditionViolation[] = [];

  // 0. Policy Engine Slot — 미래의 RBAC/ABAC/ReBAC 평가 진입점.
  //    현재 dummy는 항상 allowed=true. Action 본체 수정 없이 정책 엔진만
  //    교체할 수 있도록 자리만 잡아둔다.
  const policy = await evaluatePolicy("FinalizeApproval", {
    actor: input.approvedBy,
    targetObjectId: input.orderId,
    targetObjectType: "PurchaseOrder",
    targetAttributes: {
      orderAmount: input.orderAmount,
      budgetId: input.budgetId,
    },
  });
  if (!policy.allowed) {
    violations.push({
      code: "POLICY_DENIED",
      message: policy.reason ?? "정책에 의해 거부됨",
      severity: policy.severity === "soft" ? "soft" : "hard",
      canOverride: policy.severity === "soft",
    });
    if (policy.severity === "hard") {
      return preconditionFail(violations);
    }
  }

  // 1. 주문 존재 및 상태 확인
  const { data: order } = await supabase
    .from("order_queue")
    .select("id, status, requested_by, total_amount, budget_id")
    .eq("id", input.orderId)
    .single();

  if (!order) {
    violations.push({
      code: "ORDER_NOT_FOUND",
      message: "주문을 찾을 수 없습니다",
      severity: "hard",
      canOverride: false,
    });
    return preconditionFail(violations);
  }

  if (order.status !== "pending_approval") {
    violations.push({
      code: "INVALID_ORDER_STATUS",
      message: `현재 상태(${order.status})에서는 승인할 수 없습니다`,
      severity: "hard",
      canOverride: false,
    });
  }

  // 2. SoD: 승인자 ≠ 요청자
  if (order.requested_by === input.approvedBy) {
    violations.push({
      code: "SOD_VIOLATION",
      message: "요청자와 승인자가 동일합니다 (직무 분리 위반)",
      severity: "soft",
      canOverride: true,
    });
  }

  // 3. 예산 잔액 확인
  if (input.budgetId) {
    const { data: budget } = await supabase
      .from("budgets")
      .select("id, amount, total_spent")
      .eq("id", input.budgetId)
      .single();

    if (budget) {
      const available = budget.amount - (budget.total_spent ?? 0);
      if (available < input.orderAmount) {
        violations.push({
          code: "INSUFFICIENT_BUDGET",
          message: `예산 잔액(${available.toLocaleString()})이 주문 금액(${input.orderAmount.toLocaleString()})보다 부족합니다`,
          severity: "hard",
          canOverride: false,
        });
      }
    }
  }

  return violations.length > 0
    ? preconditionFail(violations)
    : preconditionOk();
}

/**
 * finalizeApproval 실행.
 * 1. 주문 상태를 approved로 전이
 * 2. 연결된 예산의 total_spent를 주문 금액만큼 증가
 * 3. 예산 burn_rate 재계산
 * 4. audit trace 생성
 */
export async function executeFinalizeApproval(
  input: FinalizeApprovalInput,
): Promise<ActionResult<FinalizeApprovalOutput>> {
  const auditTrace = buildAuditTrace(
    "FinalizeApproval",
    input.orderId,
    "PurchaseOrder",
    input.approvedBy,
    { from: "pending_approval", to: "approved" },
  );

  try {
    // pre-condition 재확인
    const preconditions = await checkFinalizeApprovalPreconditions(input);
    if (!preconditions.satisfied) {
      const hardBlockers = preconditions.violations.filter((v) => v.severity === "hard");
      if (hardBlockers.length > 0) {
        return {
          success: false,
          data: null,
          error: {
            code: "PRECONDITION_FAILED",
            message: hardBlockers.map((v) => v.message).join("; "),
            recoverable: true,
            suggestedAction: "예산 확인 또는 주문 상태 확인",
          },
          auditTrace: { ...auditTrace, preconditionSummary: "failed" },
        };
      }
    }

    // Step 1: 주문 상태 전이
    const { error: orderError } = await supabase
      .from("order_queue")
      .update({
        status: "approved",
        approved_by: input.approvedBy,
        approved_at: new Date().toISOString(),
        approval_comment: input.approvalComment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.orderId)
      .eq("status", "pending_approval"); // optimistic lock: 상태가 바뀌면 실패

    if (orderError) {
      return {
        success: false,
        data: null,
        error: {
          code: "ORDER_UPDATE_FAILED",
          message: `주문 상태 전이 실패: ${orderError.message}`,
          recoverable: true,
          suggestedAction: "재시도",
        },
        auditTrace: { ...auditTrace, preconditionSummary: "execution_failed" },
      };
    }

    // Step 2: 예산 차감 (연결된 예산이 있는 경우)
    let budgetUpdate: FinalizeApprovalOutput["budgetUpdate"] = null;

    if (input.budgetId) {
      const { data: budget } = await supabase
        .from("budgets")
        .select("id, amount, total_spent, burn_rate")
        .eq("id", input.budgetId)
        .single();

      if (budget) {
        const previousSpent = budget.total_spent ?? 0;
        const newSpent = previousSpent + input.orderAmount;
        const newBurnRate = budget.amount > 0 ? (newSpent / budget.amount) * 100 : 0;

        // 예산 상태 계산
        let newStatus = "safe";
        if (newBurnRate > 100) newStatus = "over";
        else if (newBurnRate >= 80) newStatus = "critical";
        else if (newBurnRate >= 60) newStatus = "warning";

        const { error: budgetError } = await supabase
          .from("budgets")
          .update({
            total_spent: newSpent,
            burn_rate: Math.round(newBurnRate * 100) / 100,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.budgetId);

        if (budgetError) {
          // 예산 업데이트 실패 → 주문 승인은 유지하되 경고
          console.error("[FinalizeApproval] Budget update failed:", budgetError.message);
        } else {
          budgetUpdate = {
            budgetId: input.budgetId,
            previousSpent,
            newSpent,
            newBurnRate: Math.round(newBurnRate * 100) / 100,
          };
        }
      }
    }

    return {
      success: true,
      data: {
        orderId: input.orderId,
        newStatus: "approved",
        budgetUpdate,
        nextAction: "dispatch_preparation",
      },
      error: null,
      auditTrace,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: {
        code: "UNEXPECTED_ERROR",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
        recoverable: false,
        suggestedAction: null,
      },
      auditTrace: { ...auditTrace, preconditionSummary: "exception" },
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ReceiveOrder — 물품 수령 + 재고 반영 (atomic)
// ══════════════════════════════════════════════════════════════════════════════

export interface ReceiveOrderInput {
  /** 수령 대상 주문 ID */
  orderId: string;
  /** 수령 수량 */
  receivedQuantity: number;
  /** 단위 */
  unit: string;
  /** LOT 번호 */
  lotNumber: string | null;
  /** 유효기간 */
  expiryDate: string | null;
  /** 수령자 */
  receivedBy: string;
  /** 검수 결과 */
  inspectionResult: "accepted" | "accepted_with_note" | "partial_received" | "rejected" | "damaged";
  /** 검수 메모 */
  inspectionNote: string | null;
  /** 반영할 재고 ID (기존 재고에 추가) 또는 null (신규 재고 생성) */
  inventoryId: string | null;
  /** 제품 ID (신규 재고 생성 시 필수) */
  productId: string;
  /** 보관 위치 */
  storageLocation: string | null;
}

export interface ReceiveOrderOutput {
  /** 수령 처리된 주문 ID */
  orderId: string;
  /** 새 주문 상태 */
  newStatus: string;
  /** 재고 업데이트 결과 */
  inventoryUpdate: {
    inventoryId: string;
    previousQuantity: number;
    newQuantity: number;
    stockStatus: string;
  };
  /** 생성된 입고 기록 ID */
  receivingRecordId: string;
}

/**
 * 수령 전 pre-condition 검증.
 * - 주문이 수령 가능 상태인지 (sent/confirmed)
 * - 수량이 양수인지
 * - rejected가 아닌 이상 재고 반영 가능한지
 */
export async function checkReceiveOrderPreconditions(
  input: ReceiveOrderInput,
): Promise<PreconditionResult> {
  const violations: PreconditionViolation[] = [];

  // 0. Policy Engine Slot — 미래 정책 엔진 진입점. 현재 dummy.
  const policy = await evaluatePolicy("ReceiveOrder", {
    actor: input.receivedBy,
    targetObjectId: input.orderId,
    targetObjectType: "PurchaseOrder",
    targetAttributes: {
      receivedQuantity: input.receivedQuantity,
      inspectionResult: input.inspectionResult,
    },
  });
  if (!policy.allowed) {
    violations.push({
      code: "POLICY_DENIED",
      message: policy.reason ?? "정책에 의해 거부됨",
      severity: policy.severity === "soft" ? "soft" : "hard",
      canOverride: policy.severity === "soft",
    });
    if (policy.severity === "hard") {
      return preconditionFail(violations);
    }
  }

  const { data: order } = await supabase
    .from("order_queue")
    .select("id, status, product_id, expected_quantity")
    .eq("id", input.orderId)
    .single();

  if (!order) {
    violations.push({
      code: "ORDER_NOT_FOUND",
      message: "주문을 찾을 수 없습니다",
      severity: "hard",
      canOverride: false,
    });
    return preconditionFail(violations);
  }

  const receivableStatuses = ["sent", "confirmed", "approved", "dispatched"];
  if (!receivableStatuses.includes(order.status)) {
    violations.push({
      code: "INVALID_ORDER_STATUS",
      message: `현재 상태(${order.status})에서는 물품을 수령할 수 없습니다`,
      severity: "hard",
      canOverride: false,
    });
  }

  if (input.receivedQuantity <= 0) {
    violations.push({
      code: "INVALID_QUANTITY",
      message: "수령 수량은 0보다 커야 합니다",
      severity: "hard",
      canOverride: false,
    });
  }

  // 과다 수령 경고
  if (order.expected_quantity && input.receivedQuantity > order.expected_quantity) {
    violations.push({
      code: "OVER_RECEIPT",
      message: `수령 수량(${input.receivedQuantity})이 예상 수량(${order.expected_quantity})을 초과합니다`,
      severity: "soft",
      canOverride: true,
    });
  }

  return violations.length > 0
    ? preconditionFail(violations)
    : preconditionOk();
}

/**
 * receiveOrder 실행.
 * 1. 주문 상태를 received로 전이
 * 2. inventory 수량 업데이트 (기존 재고 += 수령량, 또는 신규 생성)
 * 3. receiving_records에 입고 기록 삽입
 * 4. audit trace 생성
 */
export async function executeReceiveOrder(
  input: ReceiveOrderInput,
): Promise<ActionResult<ReceiveOrderOutput>> {
  const auditTrace = buildAuditTrace(
    "ReceiveOrder",
    input.orderId,
    "PurchaseOrder",
    input.receivedBy,
    { from: "sent", to: "received" },
  );

  try {
    // pre-condition 재확인
    const preconditions = await checkReceiveOrderPreconditions(input);
    const hardBlockers = preconditions.violations.filter((v) => v.severity === "hard");
    if (hardBlockers.length > 0) {
      return {
        success: false,
        data: null,
        error: {
          code: "PRECONDITION_FAILED",
          message: hardBlockers.map((v) => v.message).join("; "),
          recoverable: true,
          suggestedAction: "주문 상태 확인",
        },
        auditTrace: { ...auditTrace, preconditionSummary: "failed" },
      };
    }

    // 재고 반영 (rejected 검수 시 재고 미반영)
    const shouldUpdateInventory = input.inspectionResult !== "rejected";
    let inventoryResult = {
      inventoryId: "",
      previousQuantity: 0,
      newQuantity: 0,
      stockStatus: "in_stock",
    };

    if (shouldUpdateInventory) {
      if (input.inventoryId) {
        // 기존 재고에 수량 추가
        const { data: existing } = await supabase
          .from("inventory")
          .select("id, quantity, reserved_quantity, reorder_point, expiry_date")
          .eq("id", input.inventoryId)
          .single();

        if (existing) {
          const prevQty = existing.quantity ?? 0;
          const newQty = prevQty + input.receivedQuantity;
          const reserved = existing.reserved_quantity ?? 0;
          const available = newQty - reserved;

          // 재고 상태 계산
          let stockStatus = "in_stock";
          if (input.expiryDate && new Date(input.expiryDate) < new Date()) {
            stockStatus = "expired";
          } else if (newQty <= 0) {
            stockStatus = "out_of_stock";
          } else if (existing.reorder_point && newQty <= existing.reorder_point) {
            stockStatus = "low_stock";
          }

          await supabase
            .from("inventory")
            .update({
              quantity: newQty,
              lot_number: input.lotNumber || existing.lot_number,
              expiry_date: input.expiryDate || existing.expiry_date,
              status: stockStatus,
              storage_location: input.storageLocation,
              updated_at: new Date().toISOString(),
            })
            .eq("id", input.inventoryId);

          inventoryResult = {
            inventoryId: input.inventoryId,
            previousQuantity: prevQty,
            newQuantity: newQty,
            stockStatus,
          };
        }
      } else {
        // 신규 재고 생성
        const newId = `inv_${Date.now().toString(36)}`;
        const stockStatus = input.receivedQuantity > 0 ? "in_stock" : "out_of_stock";

        const { data: inserted } = await supabase
          .from("inventory")
          .insert({
            id: newId,
            product_id: input.productId,
            quantity: input.receivedQuantity,
            reserved_quantity: 0,
            unit: input.unit,
            lot_number: input.lotNumber,
            expiry_date: input.expiryDate,
            storage_location: input.storageLocation,
            status: stockStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        inventoryResult = {
          inventoryId: inserted?.id ?? newId,
          previousQuantity: 0,
          newQuantity: input.receivedQuantity,
          stockStatus,
        };
      }
    }

    // 주문 상태 전이
    const newOrderStatus =
      input.inspectionResult === "rejected" ? "receiving_rejected" :
      input.inspectionResult === "partial_received" ? "partially_received" :
      "received";

    await supabase
      .from("order_queue")
      .update({
        status: newOrderStatus,
        received_by: input.receivedBy,
        received_at: new Date().toISOString(),
        received_quantity: input.receivedQuantity,
        inventory_id: inventoryResult.inventoryId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.orderId);

    // 입고 기록 생성
    const receivingRecordId = `rcv_${Date.now().toString(36)}`;
    await supabase.from("receiving_records").insert({
      id: receivingRecordId,
      order_id: input.orderId,
      product_id: input.productId,
      inventory_id: inventoryResult.inventoryId || null,
      received_quantity: input.receivedQuantity,
      unit: input.unit,
      lot_number: input.lotNumber,
      expiry_date: input.expiryDate,
      inspection_result: input.inspectionResult,
      inspection_note: input.inspectionNote,
      received_by: input.receivedBy,
      received_at: new Date().toISOString(),
      storage_location: input.storageLocation,
    });

    return {
      success: true,
      data: {
        orderId: input.orderId,
        newStatus: newOrderStatus,
        inventoryUpdate: inventoryResult,
        receivingRecordId,
      },
      error: null,
      auditTrace,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: {
        code: "UNEXPECTED_ERROR",
        message: err instanceof Error ? err.message : "알 수 없는 오류",
        recoverable: false,
        suggestedAction: null,
      },
      auditTrace: { ...auditTrace, preconditionSummary: "exception" },
    };
  }
}
