"use client";

/**
 * use-ontology-context-bridge.ts
 *
 * Hook that bridges page-level state to the OntologyContextLayer store.
 * Each page/workbench calls this hook with its current context so that
 * the "다음 작업" button knows what to resolve.
 *
 * Also listens for "ontology-action-dispatch" custom events from the
 * overlay to trigger work window opens on the current page.
 */

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useOntologyContextLayerStore } from "@/lib/store/ontology-context-layer-store";
import type { OntologyContextBridgeData } from "@/lib/store/ontology-context-layer-store";

interface OntologyContextBridgeOptions extends Partial<OntologyContextBridgeData> {
  /** Callback when the overlay dispatches a work window action */
  onActionDispatched?: (actionKey: string, targetWorkWindow: string) => void;
}

export function useOntologyContextBridge(options: OntologyContextBridgeOptions) {
  const pathname = usePathname();
  const updateContext = useOntologyContextLayerStore((s: { updateContext: (pathname: string, context: Partial<OntologyContextBridgeData>) => void }) => s.updateContext);
  const openStore = useOntologyContextLayerStore((s: { open: (pathname: string, context: Partial<OntologyContextBridgeData>) => void }) => s.open);

  // Update store context whenever options change
  useEffect(() => {
    updateContext(pathname, options);
  }, [
    pathname,
    // Stringify for stable dependency — these are arrays/objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.compareIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.quoteItems?.map((q: { id: string }) => q.id)),
    options.activeWorkWindow,
    options.currentStage,
    options.snapshotValid,
    options.policyHoldActive,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.counts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.sourcingDetail),
  ]);

  // Listen for action dispatch from the overlay
  useEffect(() => {
    if (!options.onActionDispatched) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.actionKey && detail?.targetWorkWindow) {
        options.onActionDispatched?.(detail.actionKey, detail.targetWorkWindow);
      }
    };

    window.addEventListener("ontology-action-dispatch", handler);
    return () => window.removeEventListener("ontology-action-dispatch", handler);
  }, [options.onActionDispatched]);

  // Expose a function to open the layer with fresh context
  const openWithContext = useCallback(() => {
    openStore(pathname, options);
  }, [pathname, openStore, options]);

  return { openWithContext };
}
