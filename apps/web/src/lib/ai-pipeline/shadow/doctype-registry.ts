/**
 * DocType Registry — 문서 타입별 운영 메타 관리
 *
 * 모든 문서 타입의 현재 상태를 코드/로그/운영 화면에서 일관되게 조회.
 * canary-config.ts의 환경변수 기반 설정과 병행하여
 * 런타임 상태(lastPromotion, approvalStatus 등)를 추적.
 */

import type { CanaryStage, AutoVerifyPolicy } from "./types";
import type { LifecycleState } from "./rollout-state-machine";
import type { OperatingState } from "./stabilization";
import { loadCanaryConfig, getDocTypeConfig } from "./canary-config";
import { toOperatingState } from "./rollout-state-machine";

export interface DocTypeRegistryEntry {
  documentType: string;
  currentStage: CanaryStage;
  lifecycleState: LifecycleState;
  restrictedAutoVerifyEnabled: boolean;
  autoVerifyPolicy: AutoVerifyPolicy | null;
  currentProvider: string | null;
  currentModel: string | null;
  minConfidence: number;
  exclusions: {
    templates: string[];
    vendors: string[];
  };
  lastPromotionAt: string | null;
  lastRollbackAt: string | null;
  currentOperatingState: OperatingState | null;
  nextEligibleReviewAt: string | null;
  approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  stabilizationStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  isFirstDocType: boolean;
  rolloutOrder: number;
}

// In-memory registry (production: DB-backed)
const registry: Map<string, DocTypeRegistryEntry> = new Map();

/**
 * 환경변수 기반 canary config에서 registry 초기화
 */
export function initializeRegistry(): void {
  const config = loadCanaryConfig();
  for (const [docType, docConfig] of Object.entries(config.docTypes)) {
    if (!registry.has(docType)) {
      const lifecycleState = canaryStageToLifecycle(docConfig.stage);
      registry.set(docType, {
        documentType: docType,
        currentStage: docConfig.stage,
        lifecycleState,
        restrictedAutoVerifyEnabled: docConfig.allowAutoVerify,
        autoVerifyPolicy: docConfig.autoVerifyPolicy ?? null,
        currentProvider: null,
        currentModel: null,
        minConfidence: docConfig.autoVerifyPolicy?.minConfidence ?? 0.8,
        exclusions: {
          templates: docConfig.autoVerifyPolicy?.excludedTemplates ?? [],
          vendors: docConfig.autoVerifyPolicy?.excludedVendors ?? [],
        },
        lastPromotionAt: null,
        lastRollbackAt: null,
        currentOperatingState: toOperatingState(lifecycleState),
        nextEligibleReviewAt: null,
        approvalStatus: "NONE",
        stabilizationStatus: "NOT_STARTED",
        isFirstDocType: false,
        rolloutOrder: 0,
      });
    }
  }
}

/**
 * 특정 문서 타입의 registry entry 조회
 */
export function getRegistryEntry(documentType: string): DocTypeRegistryEntry | null {
  // registry가 비어있으면 초기화
  if (registry.size === 0) {
    initializeRegistry();
  }
  return registry.get(documentType) ?? null;
}

/**
 * 전체 registry 조회
 */
export function getAllRegistryEntries(): DocTypeRegistryEntry[] {
  if (registry.size === 0) {
    initializeRegistry();
  }
  return Array.from(registry.values());
}

/**
 * Registry entry 업데이트 (state machine을 통해서만 호출)
 */
export function updateRegistryEntry(
  documentType: string,
  updates: Partial<Omit<DocTypeRegistryEntry, "documentType">>,
): DocTypeRegistryEntry {
  const existing = getRegistryEntry(documentType);
  if (!existing) {
    // 새로 등록
    const entry: DocTypeRegistryEntry = {
      documentType,
      currentStage: "OFF",
      lifecycleState: "OFF",
      restrictedAutoVerifyEnabled: false,
      autoVerifyPolicy: null,
      currentProvider: null,
      currentModel: null,
      minConfidence: 0.8,
      exclusions: { templates: [], vendors: [] },
      lastPromotionAt: null,
      lastRollbackAt: null,
      currentOperatingState: null,
      nextEligibleReviewAt: null,
      approvalStatus: "NONE",
      stabilizationStatus: "NOT_STARTED",
      isFirstDocType: false,
      rolloutOrder: registry.size,
      ...updates,
    };
    registry.set(documentType, entry);
    return entry;
  }

  const updated = { ...existing, ...updates };
  registry.set(documentType, updated);
  return updated;
}

/**
 * 첫 번째 문서 타입 마킹
 */
export function markAsFirstDocType(documentType: string): void {
  updateRegistryEntry(documentType, { isFirstDocType: true, rolloutOrder: 0 });
}

/**
 * 첫 번째 문서 타입의 현재 상태 조회
 */
export function getFirstDocTypeState(): DocTypeRegistryEntry | null {
  const entries = getAllRegistryEntries();
  return entries.find((e) => e.isFirstDocType) ?? null;
}

function canaryStageToLifecycle(stage: CanaryStage): LifecycleState {
  return stage as LifecycleState; // OFF~ACTIVE_100 동일
}
