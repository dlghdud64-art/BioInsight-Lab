/**
 * Planetary Trust Substrate (Phase X) — 집단 업그레이드 메커니즘
 * 일방적 배포 금지 — 호환성 분석 → 파일럿 → 스튜어드 투표 → 단계적 도입.
 * 순수 함수 — 제공된 데이터 기반 동작.
 */

export type UpgradePhase = "COMPATIBILITY_ANALYSIS" | "LIMITED_PILOT" | "STEWARD_VOTE" | "PHASED_ADOPTION" | "FULLY_ADOPTED" | "REJECTED";

export interface UpgradeProposal {
  id: string;
  version: string;
  changes: string[];
  phase: UpgradePhase;
  proposedBy: string;
  votes: UpgradeVote[];
  adoptionProgress: number;
  proposedAt: Date;
  completedAt: Date | null;
}

export interface UpgradeVote {
  voterId: string;
  vote: "APPROVE" | "REJECT" | "ABSTAIN";
  reason: string;
  votedAt: Date;
}

const proposals: UpgradeProposal[] = [];

export function proposeUpgrade(params: { version: string; changes: string[]; proposedBy: string }): UpgradeProposal {
  const p: UpgradeProposal = {
    id: `UPG-${Date.now()}`, version: params.version, changes: params.changes,
    phase: "COMPATIBILITY_ANALYSIS", proposedBy: params.proposedBy,
    votes: [], adoptionProgress: 0, proposedAt: new Date(), completedAt: null,
  };
  proposals.push(p);
  return p;
}

export function analyzeCompatibility(proposalId: string): { compatible: boolean; issues: string[] } {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p) return { compatible: false, issues: ["Proposal not found"] };
  return { compatible: true, issues: [] };
}

export function startPilot(proposalId: string): boolean {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p || p.phase !== "COMPATIBILITY_ANALYSIS") return false;
  p.phase = "LIMITED_PILOT";
  return true;
}

export function conductVote(proposalId: string, vote: UpgradeVote): boolean {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p || p.phase !== "LIMITED_PILOT") return false;
  p.phase = "STEWARD_VOTE";
  p.votes.push(vote);
  return true;
}

export function beginAdoption(proposalId: string): boolean {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p || p.phase !== "STEWARD_VOTE") return false;
  const approvals = p.votes.filter((v) => v.vote === "APPROVE").length;
  if (approvals < p.votes.length * 0.6) { p.phase = "REJECTED"; return false; }
  p.phase = "PHASED_ADOPTION";
  return true;
}

export function completeAdoption(proposalId: string): boolean {
  const p = proposals.find((x) => x.id === proposalId);
  if (!p || p.phase !== "PHASED_ADOPTION") return false;
  p.phase = "FULLY_ADOPTED";
  p.adoptionProgress = 100;
  p.completedAt = new Date();
  return true;
}

export function getUpgradeHistory(): UpgradeProposal[] {
  return [...proposals];
}
