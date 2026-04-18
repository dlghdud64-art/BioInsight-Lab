/**
 * Evidence Fabric — 감사 증적 체인
 *
 * 원본 문서 포인터, 정책 버전 스냅샷, 결재 증적, 티켓 ID를
 * 단일 체인으로 묶어 감사(Audit)나 분쟁 시 완벽히 재구성합니다.
 */

import { createHash } from "crypto";

// ── Types ──

export interface EvidenceLink {
  type: "DOCUMENT" | "POLICY_SNAPSHOT" | "APPROVAL" | "TICKET" | "EVENT" | "COMPARISON_LOG" | "REVIEW";
  referenceId: string;
  system: string;
  timestamp: string;
  hash: string;          // integrity hash
  metadata: Record<string, unknown>;
}

export interface EvidenceChain {
  chainId: string;
  tenantId: string;
  subjectType: string;     // e.g., "DOCUMENT_VERIFICATION", "INCIDENT"
  subjectId: string;
  createdAt: string;
  lastUpdatedAt: string;
  links: EvidenceLink[];
  integrityHash: string;   // hash of entire chain
  sealed: boolean;         // once sealed, no more links can be added
}

// In-memory store
const chains: EvidenceChain[] = [];

/**
 * 새 증적 체인 생성
 */
export function createEvidenceChain(params: {
  tenantId: string;
  subjectType: string;
  subjectId: string;
}): EvidenceChain {
  const chain: EvidenceChain = {
    chainId: `EC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    links: [],
    integrityHash: "",
    sealed: false,
  };

  chain.integrityHash = computeChainHash(chain);
  chains.push(chain);
  return chain;
}

/**
 * 증적 링크 추가
 */
export function addEvidenceLink(chainId: string, link: Omit<EvidenceLink, "hash">): {
  added: boolean;
  reason?: string;
} {
  const chain = chains.find((c) => c.chainId === chainId);
  if (!chain) return { added: false, reason: "Chain not found" };
  if (chain.sealed) return { added: false, reason: "Chain is sealed — no more links allowed" };

  const fullLink: EvidenceLink = {
    ...link,
    hash: computeLinkHash(link),
  };

  chain.links.push(fullLink);
  chain.lastUpdatedAt = new Date().toISOString();
  chain.integrityHash = computeChainHash(chain);

  return { added: true };
}

/**
 * 체인 봉인 — 이후 변경 불가
 */
export function sealChain(chainId: string): boolean {
  const chain = chains.find((c) => c.chainId === chainId);
  if (!chain || chain.sealed) return false;
  chain.sealed = true;
  chain.integrityHash = computeChainHash(chain);
  return true;
}

/**
 * 체인 무결성 검증
 */
export function verifyChainIntegrity(chainId: string): {
  valid: boolean;
  expectedHash: string;
  actualHash: string;
} {
  const chain = chains.find((c) => c.chainId === chainId);
  if (!chain) return { valid: false, expectedHash: "", actualHash: "" };

  const computed = computeChainHash(chain);
  return {
    valid: computed === chain.integrityHash,
    expectedHash: chain.integrityHash,
    actualHash: computed,
  };
}

/**
 * 체인 조회
 */
export function getEvidenceChain(chainId: string): EvidenceChain | undefined {
  return chains.find((c) => c.chainId === chainId);
}

export function getChainsBySubject(subjectType: string, subjectId: string): EvidenceChain[] {
  return chains.filter((c) => c.subjectType === subjectType && c.subjectId === subjectId);
}

export function getChainsByTenant(tenantId: string): EvidenceChain[] {
  return chains.filter((c) => c.tenantId === tenantId);
}

/**
 * 감사용 증적 패키지 추출 — 민감 정보 마스킹
 */
export function exportEvidencePackage(chainId: string, options?: {
  redactFields?: string[];
}): {
  chain: EvidenceChain;
  exportedAt: string;
  exportHash: string;
} | null {
  const chain = chains.find((c) => c.chainId === chainId);
  if (!chain) return null;

  // Deep copy for redaction
  const exported = JSON.parse(JSON.stringify(chain)) as EvidenceChain;

  if (options?.redactFields) {
    for (const link of exported.links) {
      for (const field of options.redactFields) {
        if (field in link.metadata) {
          (link.metadata as Record<string, unknown>)[field] = "[REDACTED]";
        }
      }
    }
  }

  return {
    chain: exported,
    exportedAt: new Date().toISOString(),
    exportHash: createHash("sha256").update(JSON.stringify(exported)).digest("hex"),
  };
}

// ── Helpers ──

function computeLinkHash(link: Omit<EvidenceLink, "hash">): string {
  const data = `${link.type}:${link.referenceId}:${link.system}:${link.timestamp}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function computeChainHash(chain: EvidenceChain): string {
  const linkHashes = chain.links.map((l) => l.hash).join(":");
  const data = `${chain.chainId}:${chain.tenantId}:${chain.subjectType}:${chain.subjectId}:${linkHashes}:${chain.sealed}`;
  return createHash("sha256").update(data).digest("hex");
}
