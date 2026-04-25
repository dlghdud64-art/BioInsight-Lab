/**
 * apps/web/src/lib/quote/resolve-add-to-quote-toast.ts
 *
 * Single source of truth for sourcing → quote candidacy toast copy.
 *
 * Why this exists (#P02-e2e-blocker)
 * ----------------------------------
 * Before this fix, sourcing-result-row fired
 *   `toast.success("견적함에 성공적으로 담겼습니다.")`
 * unconditionally, regardless of whether the underlying
 * addProductToQuote succeeded or silently bailed on a missing
 * vendor. That is the textbook LabAxis "fake success" pattern.
 *
 * Now the call site:
 *   const result = addProductToQuote(product, vendorId);
 *   const { intent, message } = resolveAddToQuoteToast(result);
 *   toast[intent](message);
 *
 * Toast copy stays in lockstep with the actual result mode. The
 * three success modes get visibly distinct copy so the user can
 * tell "added", "vendor-pending", and "merged" apart at a glance.
 */

import type { ComputeAddToQuoteResult } from "@/lib/quote/add-product-to-quote";

export type ToastIntent = "success" | "info" | "error";

export type ToastInstruction = {
  intent: ToastIntent;
  message: string;
};

export const ADD_TO_QUOTE_TOAST = {
  added: "견적함에 성공적으로 담겼습니다.",
  vendorPending:
    "견적 후보에 추가했어요. 가격은 견적 요청 후 확정됩니다.",
  merged: "이미 담긴 항목이라 수량을 1 늘렸어요.",
  missingProductId:
    "견적함에 담을 수 없습니다 — 제품 정보를 다시 확인해 주세요.",
} as const;

export function resolveAddToQuoteToast(
  result: ComputeAddToQuoteResult,
): ToastInstruction {
  if (!result.ok) {
    // Today only one failure reason exists; the switch is here so a
    // future caller adding a new reason gets a TS error instead of
    // a silent generic fallback.
    switch (result.reason) {
      case "missing-product-id":
        return { intent: "error", message: ADD_TO_QUOTE_TOAST.missingProductId };
      default: {
        const _exhaustive: never = result.reason;
        return {
          intent: "error",
          message: ADD_TO_QUOTE_TOAST.missingProductId,
        };
      }
    }
  }

  switch (result.mode) {
    case "added":
      return { intent: "success", message: ADD_TO_QUOTE_TOAST.added };
    case "vendor-pending":
      return { intent: "info", message: ADD_TO_QUOTE_TOAST.vendorPending };
    case "merged":
      return { intent: "info", message: ADD_TO_QUOTE_TOAST.merged };
    default: {
      const _exhaustive: never = result.mode;
      return { intent: "info", message: ADD_TO_QUOTE_TOAST.added };
    }
  }
}
