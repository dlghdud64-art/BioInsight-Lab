"use client";

/**
 * useOpenGovernedComposer — 진입점별 composer open helper
 *
 * 각 surface에서 context를 조립해 composer store에 주입.
 * dry-run context는 진입점이 직접 계산하거나 null(lazy hydration)로 넘길 수 있다.
 */

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  useGovernedActionComposerStore,
  type ComposerOrigin,
} from "@/lib/store/governed-action-composer-store";
import type { ComposerWorkbenchContext } from "@/lib/governed-action/governed-action-intent-engine";
import type { DryRunContext } from "@/lib/governed-action/governed-action-dryrun-engine";

interface OpenComposerOptions {
  origin: ComposerOrigin;
  workbenchStage?: ComposerWorkbenchContext["workbenchStage"];
  selectedEntityIds?: string[];
  selectedEntityType?: ComposerWorkbenchContext["selectedEntityType"];
  currentStatus?: string | null;
  linkedPoNumber?: string | null;
  linkedSupplierName?: string | null;
  dryRunContext?: DryRunContext | null;
}

export function useOpenGovernedComposer() {
  const pathname = usePathname();
  const openComposer = useGovernedActionComposerStore((s) => s.openComposer);

  const open = useCallback(
    (opts: OpenComposerOptions) => {
      const context: ComposerWorkbenchContext = {
        currentRoute: pathname,
        workbenchStage: opts.workbenchStage ?? null,
        selectedEntityIds: opts.selectedEntityIds ?? [],
        selectedEntityType: opts.selectedEntityType ?? null,
        currentStatus: opts.currentStatus ?? null,
        linkedPoNumber: opts.linkedPoNumber ?? null,
        linkedSupplierName: opts.linkedSupplierName ?? null,
      };

      openComposer({
        origin: opts.origin,
        context,
        dryRunContext: opts.dryRunContext ?? null,
      });
    },
    [pathname, openComposer],
  );

  return open;
}
