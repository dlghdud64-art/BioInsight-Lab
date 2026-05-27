/**
 * Persistence Adapter Interface
 *
 * sessionStorage 기반 3종(governance event dedupe, approval baseline, outbound history)을
 * adapter/repository boundary 뒤로 숨겨 비즈니스 로직이 storage 구현에 직접 의존하지 않게 한다.
 *
 * 계약:
 * - load(): 저장소에서 읽기 (없으면 null)
 * - persist(): 저장소에 쓰기
 * - clear(): 저장소에서 삭제
 * - hydrateIfEmpty(current): current 가 비어있으면 load()로 채우기
 *
 * 기본 구현: SessionStorageAdapter (현 상태 유지)
 * 추후 Supabase/DB adapter로 교체 가능.
 *
 * SSR-safe / re-entry-safe / hydration-safe 유지.
 */

// ══════════════════════════════════════════════
// Generic Persistence Adapter Interface
// ══════════════════════════════════════════════

export interface PersistenceAdapter<T> {
  /** 저장소에서 데이터를 읽는다. 없으면 null. */
  load(key: string): T | null;
  /** 저장소에 데이터를 쓴다. */
  persist(key: string, data: T): void;
  /** 저장소에서 데이터를 삭제한다. */
  clear(key: string): void;
  /** current가 비어있으면(null/undefined) load()로 채운다. 채워진 값을 반환. */
  hydrateIfEmpty(key: string, current: T | null): T | null;
}

// ══════════════════════════════════════════════
// SessionStorage Adapter (기본 구현)
// ══════════════════════════════════════════════

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * SessionStorage 기반 generic adapter.
 * SSR-safe: window 없으면 no-op.
 */
export class SessionStorageAdapter<T> implements PersistenceAdapter<T> {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  load(key: string): T | null {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(this.fullKey(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  persist(key: string, data: T): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.fullKey(key), JSON.stringify(data));
    } catch {
      // storage full — silent fail (best-effort)
    }
  }

  clear(key: string): void {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(this.fullKey(key));
  }

  hydrateIfEmpty(key: string, current: T | null): T | null {
    if (current !== null && current !== undefined) return current;
    return this.load(key);
  }

  /** prefix로 시작하는 모든 키를 삭제한다. (PO 단위 clear 등) */
  clearByPrefix(keyPrefix: string): void {
    const storage = getStorage();
    if (!storage) return;
    const fullPrefix = `${this.prefix}${keyPrefix}`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(fullPrefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  }
}

// ══════════════════════════════════════════════
// Domain-specific adapter instances (singleton)
// ══════════════════════════════════════════════

import type { ApprovalPoSnapshot } from "@/lib/ai/approval-snapshot-store";

export type OutboundHistoryRecord = {
  poId: string;
  type: string;
  timestamp: string;
  actor: string;
  payload: Record<string, unknown>;
};

export type DedupeRecord = {
  timestamp: number;
  signature: string;
};

/** Governance event dedupe adapter */
let _dedupeAdapter: PersistenceAdapter<DedupeRecord> | null = null;
export function getDedupeAdapter(): PersistenceAdapter<DedupeRecord> {
  if (!_dedupeAdapter) {
    _dedupeAdapter = new SessionStorageAdapter<DedupeRecord>("labaxis_gov_dedupe_");
  }
  return _dedupeAdapter;
}

/** Approval baseline adapter */
let _approvalAdapter: PersistenceAdapter<ApprovalPoSnapshot> | null = null;
export function getApprovalBaselineAdapter(): PersistenceAdapter<ApprovalPoSnapshot> {
  if (!_approvalAdapter) {
    _approvalAdapter = new SessionStorageAdapter<ApprovalPoSnapshot>("labaxis:approval-snapshot:");
  }
  return _approvalAdapter;
}

/** Governance dedupe signature adapter (string-value, signature-equality semantics) */
let _dedupeSignatureAdapter: PersistenceAdapter<string> | null = null;
export function getDedupeSignatureAdapter(): PersistenceAdapter<string> {
  if (!_dedupeSignatureAdapter) {
    _dedupeSignatureAdapter = new SessionStorageAdapter<string>("labaxis:gov-dedupe:");
  }
  return _dedupeSignatureAdapter;
}

/** Outbound history adapter */
let _outboundAdapter: PersistenceAdapter<OutboundHistoryRecord[]> | null = null;
export function getOutboundHistoryAdapter(): PersistenceAdapter<OutboundHistoryRecord[]> {
  if (!_outboundAdapter) {
    _outboundAdapter = new SessionStorageAdapter<OutboundHistoryRecord[]>("labaxis_outbound_history::");
  }
  return _outboundAdapter;
}

// ══════════════════════════════════════════════
// Adapter injection for testing / Supabase 교체
// ══════════════════════════════════════════════

export function setDedupeAdapter(adapter: PersistenceAdapter<DedupeRecord>): void {
  _dedupeAdapter = adapter;
}

export function setApprovalBaselineAdapter(adapter: PersistenceAdapter<ApprovalPoSnapshot>): void {
  _approvalAdapter = adapter;
}

export function setOutboundHistoryAdapter(adapter: PersistenceAdapter<OutboundHistoryRecord[]>): void {
  _outboundAdapter = adapter;
}

export function setDedupeSignatureAdapter(adapter: PersistenceAdapter<string>): void {
  _dedupeSignatureAdapter = adapter;
}

// ══════════════════════════════════════════════
// Adapter helpers — pattern clear (clearByPrefix-capable adapters만)
// ══════════════════════════════════════════════

/**
 * adapter 가 clearByPrefix 를 지원하면 호출, 아니면 no-op.
 * SessionStorageAdapter 는 지원, 추후 DB adapter 는 자체 SQL prefix delete 로 교체.
 */
export function clearAdapterByPrefix<T>(
  adapter: PersistenceAdapter<T>,
  prefix: string,
): void {
  if (
    "clearByPrefix" in adapter &&
    typeof (adapter as { clearByPrefix?: (p: string) => void }).clearByPrefix === "function"
  ) {
    (adapter as { clearByPrefix: (p: string) => void }).clearByPrefix(prefix);
  }
}
