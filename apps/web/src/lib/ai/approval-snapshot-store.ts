export type ApprovalPoSnapshot = {
  poId: string;
  snapshotAt: string;
  data: unknown;
};

export function ensureApprovalSnapshot(_poId: string, _data: unknown): void {}
export function getApprovalSnapshot(_poId: string): ApprovalPoSnapshot | null { return null; }
