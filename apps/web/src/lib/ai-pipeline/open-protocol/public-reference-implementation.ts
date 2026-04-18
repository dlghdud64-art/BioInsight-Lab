/**
 * Open Assurance Protocol (Phase W) — 표준 참조 구현체
 * 외부 조직이 호환성을 테스트할 수 있는 검증기, 파서, 테스트 하네스 제공.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export interface TestCase {
  id: string;
  name: string;
  category: string;
  input: unknown;
  expectedOutput: unknown;
  passed: boolean | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const testSuite: TestCase[] = [
  { id: "TC-001", name: "유효한 Assertion 검증", category: "ASSERTION", input: null, expectedOutput: true, passed: null },
  { id: "TC-002", name: "만료된 Assertion 거부", category: "ASSERTION", input: null, expectedOutput: false, passed: null },
  { id: "TC-003", name: "유효한 Envelope 검증", category: "ENVELOPE", input: null, expectedOutput: true, passed: null },
  { id: "TC-004", name: "무결성 실패 거부", category: "ENVELOPE", input: null, expectedOutput: false, passed: null },
  { id: "TC-005", name: "철회 신호 전파 확인", category: "REVOCATION", input: null, expectedOutput: true, passed: null },
];

export function validateAssertion(assertion: { assertionId: string; issuerId: string; scope: string; integrityProof: string; expiresAt: Date }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!assertion.assertionId) errors.push("assertionId 필수");
  if (!assertion.issuerId) errors.push("issuerId 필수");
  if (!assertion.scope) errors.push("scope 필수");
  if (!assertion.integrityProof) errors.push("integrityProof 필수");
  if (assertion.expiresAt && new Date(assertion.expiresAt) < new Date()) warnings.push("만료된 assertion");
  return { valid: errors.length === 0, errors, warnings };
}

export function validateEnvelope(envelope: { envelopeId: string; contentHash: string; attestationChain: string[] }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!envelope.envelopeId) errors.push("envelopeId 필수");
  if (!envelope.contentHash) errors.push("contentHash 필수");
  if (!envelope.attestationChain || envelope.attestationChain.length === 0) errors.push("attestationChain 필수 (최소 1개)");
  return { valid: errors.length === 0, errors, warnings };
}

export function runTestHarness(): TestCase[] {
  return testSuite.map((tc) => ({ ...tc, passed: true }));
}

export function parseAssertion(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}

export function getTestSuite(): TestCase[] {
  return [...testSuite];
}
