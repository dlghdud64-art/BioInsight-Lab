/**
 * Open Assurance Protocol (Phase W) — 프로토콜 버전 생애주기
 * 프로토콜 버전의 Draft → Stable → Retired 생애주기를 시스템화한다.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export type VersionStatus = "DRAFT" | "CANDIDATE" | "STABLE" | "DEPRECATED" | "RETIRED";

export interface ProtocolVersion {
  version: string;
  status: VersionStatus;
  releasedAt: Date | null;
  deprecatedAt: Date | null;
  retiredAt: Date | null;
  breakingChanges: string[];
  adopters: string[];
}

const versions: ProtocolVersion[] = [];

export function registerVersion(version: string, breakingChanges: string[]): ProtocolVersion {
  const pv: ProtocolVersion = {
    version, status: "DRAFT", releasedAt: null, deprecatedAt: null, retiredAt: null,
    breakingChanges, adopters: [],
  };
  versions.push(pv);
  return pv;
}

export function promoteToCandidate(version: string): boolean {
  const pv = versions.find((v) => v.version === version);
  if (!pv || pv.status !== "DRAFT") return false;
  pv.status = "CANDIDATE";
  return true;
}

export function promoteToStable(version: string): boolean {
  const pv = versions.find((v) => v.version === version);
  if (!pv || pv.status !== "CANDIDATE") return false;
  pv.status = "STABLE";
  pv.releasedAt = new Date();
  return true;
}

export function deprecateVersion(version: string): boolean {
  const pv = versions.find((v) => v.version === version);
  if (!pv || pv.status !== "STABLE") return false;
  pv.status = "DEPRECATED";
  pv.deprecatedAt = new Date();
  return true;
}

export function retireVersion(version: string): boolean {
  const pv = versions.find((v) => v.version === version);
  if (!pv || pv.status !== "DEPRECATED") return false;
  pv.status = "RETIRED";
  pv.retiredAt = new Date();
  return true;
}

export function getVersion(version: string): ProtocolVersion | undefined {
  return versions.find((v) => v.version === version);
}

export function getStableVersions(): ProtocolVersion[] {
  return versions.filter((v) => v.status === "STABLE");
}

export function getVersionHistory(): ProtocolVersion[] {
  return [...versions];
}
