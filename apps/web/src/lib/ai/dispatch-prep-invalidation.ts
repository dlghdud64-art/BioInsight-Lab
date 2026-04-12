export type DispatchReadinessState = "idle" | "ready" | "blocked" | "scheduled" | "cancelled";
export function emitPoDataChangedAfterApproval(_poId: string): void {}
export function emitDispatchPrepReadinessChanged(_state: DispatchReadinessState): void {}
export function emitDispatchPrepBlocked(_reason: string): void {}
export function emitDispatchPrepSendScheduled(_scheduledAt: Date): void {}
export function emitDispatchPrepCancelled(): void {}
