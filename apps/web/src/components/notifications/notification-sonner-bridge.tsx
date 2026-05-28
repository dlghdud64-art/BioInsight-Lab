"use client";

/**
 * Notification → Sonner Toast Bridge (client subscriber)
 *
 * 책임:
 * - useNotificationStore.lastPublishedId 변경을 감지해 sonner toast 발사
 * - governance-bridge에서 notification store로 들어온 항목을 시각적으로 표시
 *
 * 고정 규칙:
 * 1. 본 컴포넌트는 mount 시 governance bridge를 활성화한다 (단일 진입점).
 * 2. 본 컴포넌트는 표시만 한다. 어떤 mutation도 일으키지 않는다.
 * 3. 최초 mount 직후에 store에 이미 쌓여 있던 알림은 toast로 재발사하지 않는다
 *    (페이지 전환 시 토스트 폭주 방지). 새로 push된 항목만 발사.
 * 4. 본 컴포넌트는 UI를 렌더하지 않는다. SonnerToaster는 layout.tsx에 별도 mount되어 있음.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useNotificationStore, type LocalNotification } from "@/lib/store/notification-store";
import { startGovernanceNotificationBridge } from "@/lib/notifications/governance-bridge";
import { useOrderPeekOverlayStore } from "@/lib/store/order-peek-overlay-store";

export function NotificationSonnerBridge() {
  // ── 1. governance bridge 활성화 (mount 한 번) ─────────────────────────────
  useEffect(() => {
    const stop = startGovernanceNotificationBridge();
    return stop;
  }, []);

  // ── 2. notification store 변경 감지 → sonner 발사 ─────────────────────────
  const initializedRef = useRef(false);
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    // 최초 mount 시점의 lastPublishedId를 baseline으로 잡고, 이후 변경만 toast 발사
    const initial = useNotificationStore.getState().lastPublishedId;
    lastSeenIdRef.current = initial;
    initializedRef.current = true;

    const unsubscribe = useNotificationStore.subscribe((state) => {
      if (!initializedRef.current) return;
      const id = state.lastPublishedId;
      if (!id || id === lastSeenIdRef.current) return;

      lastSeenIdRef.current = id;
      const notif = state.notifications.find((n) => n.id === id);
      if (!notif) return;

      fireToast(notif);
    });

    return () => {
      unsubscribe();
      initializedRef.current = false;
    };
  }, []);

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// helpers
// ══════════════════════════════════════════════════════════════════════════════

function fireToast(notif: LocalNotification): void {
  const description = notif.description ?? undefined;

  // PO entity 알림 → "빠른 보기" action button 추가.
  // 클릭 시 peek drawer 가 열려 워크벤치 진입 없이 1-shot 요약을 보여준다.
  const action =
    notif.entityType === "PO" && notif.entityId
      ? {
          label: "빠른 보기",
          onClick: () => {
            useOrderPeekOverlayStore
              .getState()
              .openById(notif.entityId!, notif.title);
          },
        }
      : undefined;

  switch (notif.severity) {
    case "error":
      toast.error(notif.title, { description, action });
      return;
    case "warning":
      toast.warning(notif.title, { description, action });
      return;
    case "success":
      toast.success(notif.title, { description, action });
      return;
    case "info":
    default:
      toast.info(notif.title, { description, action });
      return;
  }
}
