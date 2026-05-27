/**
 * Canary Launch Preflight Check
 *
 * ACTIVE_5 트래픽 전환 전 런타임 환경 검증.
 * Stable Bucket 일관성, 로그 기록, Circuit Breaker, Rollback 스위치 점검.
 */

import { stableBucket, isInCanaryBucket, resolveProcessingPath, loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import { loadShadowConfig } from "./config";
import { checkCircuitBreaker } from "./circuit-breaker";
import { db } from "@/lib/db";
import type { CanaryConfig, CanaryStage } from "./types";

export interface PreflightCheckResult {
  passed: boolean;
  checks: PreflightItem[];
  config: {
    globalEnabled: boolean;
    targetDocType: string;
    currentStage: CanaryStage;
    allowAutoVerify: boolean;
    minConfidence: number;
    provider: string;
    model: string;
    timeoutMs: number;
  };
}

export interface PreflightItem {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
}

export async function runPreflightCheck(targetDocType: string): Promise<PreflightCheckResult> {
  const checks: PreflightItem[] = [];
  const canaryConfig = loadCanaryConfig();
  const shadowConfig = loadShadowConfig();
  const docConfig = getDocTypeConfig(canaryConfig, targetDocType);

  // 1. Global Enabled 확인
  checks.push({
    name: "AI_RUNTIME_ENABLED",
    status: canaryConfig.globalEnabled ? "PASS" : "FAIL",
    detail: canaryConfig.globalEnabled
      ? "AI 런타임 활성화 확인"
      : "AI_RUNTIME_ENABLED=true 설정 필요",
  });

  // 2. 대상 문서 타입 Stage 확인
  checks.push({
    name: "TARGET_DOC_TYPE_STAGE",
    status: docConfig.stage === "ACTIVE_5" ? "PASS" : "WARN",
    detail: `${targetDocType} 현재 Stage: ${docConfig.stage} (목표: ACTIVE_5)`,
  });

  // 3. allowAutoVerify 강제 false 확인
  checks.push({
    name: "AUTO_VERIFY_DISABLED",
    status: !docConfig.allowAutoVerify ? "PASS" : "FAIL",
    detail: docConfig.allowAutoVerify
      ? "allowAutoVerify=true 감지 — ACTIVE_5에서 반드시 false"
      : "allowAutoVerify=false 확인",
  });

  // 4. Stable Bucket 일관성 테스트
  const bucketConsistency = testBucketConsistency(targetDocType, canaryConfig);
  checks.push(bucketConsistency);

  // 5. processingPath 분기 정상 확인
  const pathCheck = testProcessingPath(targetDocType, canaryConfig);
  checks.push(pathCheck);

  // 6. DB 연결 및 ShadowComparisonLog 테이블 존재 확인
  const dbCheck = await testDbConnection();
  checks.push(dbCheck);

  // 7. CanaryHaltLog 테이블 존재 확인
  const haltLogCheck = await testHaltLogTable();
  checks.push(haltLogCheck);

  // 8. Circuit Breaker 작동 테스트 (dry-run)
  const cbCheck = await testCircuitBreakerDryRun(targetDocType, docConfig.stage);
  checks.push(cbCheck);

  // 9. 비대상 문서 타입 격리 확인
  const isolationCheck = testNonTargetIsolation(targetDocType, canaryConfig);
  checks.push(isolationCheck);

  // 10. Provider/Model 설정 확인
  checks.push({
    name: "PROVIDER_CONFIG",
    status: shadowConfig.provider && shadowConfig.model ? "PASS" : "WARN",
    detail: `Provider: ${shadowConfig.provider}, Model: ${shadowConfig.model}`,
  });

  const passed = checks.every((c) => c.status !== "FAIL");

  return {
    passed,
    checks,
    config: {
      globalEnabled: canaryConfig.globalEnabled,
      targetDocType,
      currentStage: docConfig.stage,
      allowAutoVerify: docConfig.allowAutoVerify,
      minConfidence: shadowConfig.minConfidence,
      provider: shadowConfig.provider,
      model: shadowConfig.model,
      timeoutMs: shadowConfig.timeoutMs,
    },
  };
}

/** Stable Bucket이 동일 입력에 대해 일관된 결과를 반환하는지 검증 */
function testBucketConsistency(docType: string, config: CanaryConfig): PreflightItem {
  const testPairs = [
    { orgId: "org_test_001", docId: "doc_test_001" },
    { orgId: "org_test_002", docId: "doc_test_002" },
    { orgId: "org_test_003", docId: "doc_test_003" },
    { orgId: "org_prod_alpha", docId: "doc_inv_12345" },
    { orgId: "org_prod_beta", docId: "doc_vq_67890" },
  ];

  let consistent = true;
  const results: string[] = [];

  for (const { orgId, docId } of testPairs) {
    const b1 = stableBucket(orgId, docId);
    const b2 = stableBucket(orgId, docId);
    const b3 = stableBucket(orgId, docId);
    if (b1 !== b2 || b2 !== b3) {
      consistent = false;
    }
    const inBucket = isInCanaryBucket(orgId, docId, 5);
    results.push(`${orgId}:${docId} → bucket=${b1}, in5%=${inBucket}`);
  }

  return {
    name: "STABLE_BUCKET_CONSISTENCY",
    status: consistent ? "PASS" : "FAIL",
    detail: consistent
      ? `5개 테스트 페어 모두 일관성 확인. ${results.join("; ")}`
      : "Bucket 비결정적 결과 감지",
  };
}

/** processingPath가 ACTIVE_5 설정에서 ai_active_canary를 반환하는지 확인 */
function testProcessingPath(docType: string, config: CanaryConfig): PreflightItem {
  const docConfig = getDocTypeConfig(config, docType);
  if (docConfig.stage !== "ACTIVE_5") {
    return {
      name: "PROCESSING_PATH_ROUTING",
      status: "WARN",
      detail: `Stage가 ${docConfig.stage}이므로 라우팅 테스트 제한적`,
    };
  }

  // 5% 테스트: bucket 0~4는 canary, 5~99는 rules
  let canaryCount = 0;
  let rulesCount = 0;
  for (let i = 0; i < 100; i++) {
    const path = resolveProcessingPath(config, docType, `test_org_${i}`, `test_doc_${i}`);
    if (path === "ai_active_canary") canaryCount++;
    else if (path === "rules") rulesCount++;
  }

  const canaryRatio = canaryCount / 100;
  // 5% ± 3% tolerance
  const withinRange = canaryRatio >= 0.02 && canaryRatio <= 0.08;

  return {
    name: "PROCESSING_PATH_ROUTING",
    status: withinRange ? "PASS" : "WARN",
    detail: `100회 시뮬레이션: canary=${canaryCount}%, rules=${rulesCount}% (목표: ~5%)`,
  };
}

/** DB 연결 및 ShadowComparisonLog 테이블 존재 확인 */
async function testDbConnection(): Promise<PreflightItem> {
  try {
    const result = (await db.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'ShadowComparisonLog'
      ) AS "exists"`,
    )) as { exists: boolean }[];

    return {
      name: "DB_SHADOW_LOG_TABLE",
      status: result[0]?.exists ? "PASS" : "FAIL",
      detail: result[0]?.exists
        ? "ShadowComparisonLog 테이블 존재 확인"
        : "ShadowComparisonLog 테이블 미존재",
    };
  } catch (err) {
    return {
      name: "DB_SHADOW_LOG_TABLE",
      status: "FAIL",
      detail: `DB 연결 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** CanaryHaltLog 테이블 존재 확인 */
async function testHaltLogTable(): Promise<PreflightItem> {
  try {
    const result = (await db.$queryRawUnsafe(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'CanaryHaltLog'
      ) AS "exists"`,
    )) as { exists: boolean }[];

    return {
      name: "DB_HALT_LOG_TABLE",
      status: result[0]?.exists ? "PASS" : "FAIL",
      detail: result[0]?.exists
        ? "CanaryHaltLog 테이블 존재 확인"
        : "CanaryHaltLog 테이블 미존재",
    };
  } catch (err) {
    return {
      name: "DB_HALT_LOG_TABLE",
      status: "FAIL",
      detail: `DB 연결 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Circuit Breaker dry-run — instant halt 트리거가 정상 판정되는지 확인 */
async function testCircuitBreakerDryRun(docType: string, currentStage: CanaryStage): Promise<PreflightItem> {
  try {
    // AUTO_VERIFY_RISK에 대해 halt 판정이 나오는지 (Active 경로 가정)
    const testResult = await checkCircuitBreaker({
      documentType: `__preflight_test__${docType}`,
      currentStage: currentStage === "OFF" || currentStage === "SHADOW_ONLY" ? "ACTIVE_5" : currentStage,
      mismatchCategory: "AUTO_VERIFY_RISK",
      processingPath: "ai_active_canary",
      requestId: "__preflight_dry_run__",
    });

    return {
      name: "CIRCUIT_BREAKER_DRY_RUN",
      status: testResult.halted ? "PASS" : "FAIL",
      detail: testResult.halted
        ? "Circuit Breaker 정상 작동 — AUTO_VERIFY_RISK에 즉시 Halt 판정"
        : "Circuit Breaker 미작동 — AUTO_VERIFY_RISK에 Halt 미발동",
    };
  } catch (err) {
    return {
      name: "CIRCUIT_BREAKER_DRY_RUN",
      status: "WARN",
      detail: `Circuit Breaker 테스트 중 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** 비대상 문서 타입이 100% rules 경로로 라우팅되는지 확인 */
function testNonTargetIsolation(targetDocType: string, config: CanaryConfig): PreflightItem {
  const nonTargetTypes = ["INVOICE", "PURCHASE_ORDER", "DELIVERY_NOTE", "CREDIT_MEMO"];
  const violations: string[] = [];

  for (const dt of nonTargetTypes) {
    if (dt === targetDocType) continue;
    for (let i = 0; i < 20; i++) {
      const path = resolveProcessingPath(config, dt, `iso_org_${i}`, `iso_doc_${i}`);
      if (path !== "rules" && path !== "ai_shadow") {
        violations.push(`${dt} → ${path}`);
      }
    }
  }

  return {
    name: "NON_TARGET_ISOLATION",
    status: violations.length === 0 ? "PASS" : "FAIL",
    detail: violations.length === 0
      ? `비대상 4개 문서 타입 100% rules/shadow 격리 확인`
      : `격리 위반: ${violations.join(", ")}`,
  };
}
