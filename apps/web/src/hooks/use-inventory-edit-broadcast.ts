/**
 * §11.253b-3 — 본인 다른 탭 detection (case 1, BroadcastChannel API).
 *
 * 호영님 spec case 1: "다른 탭에서 작업 중입니다. 이 탭에서 계속하시겠습니까?"
 *
 * client-side BroadcastChannel("labaxis-inventory-edit") 으로 같은 origin
 * 의 다른 탭이 동일 productId + lotNumber 작업 중인지 감지. backend 변경 0.
 *
 * 동작:
 *   - mount 시 tabId 생성 (per-tab UUID).
 *   - broadcast(productId, lotNumber): 다른 탭에 현재 작업 신호 전송.
 *   - listener: 같은 productId/lotNumber + 다른 tabId 시 otherTabActive=true.
 *   - timeout (30초) 후 otherTabActive=false (다른 탭 활동 정지 추정).
 *   - cleanup: channel.close() + timer clear.
 *
 * SSR safe — typeof window check + typeof BroadcastChannel check.
 *
 * canonical truth lock:
 *   - case 2 (다른 사용자) 는 §11.253b-2 InventoryLock 별도 cluster.
 *   - 본 hook 은 같은 origin (같은 사용자) 의 다른 탭만 detection.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHANNEL_NAME = "labaxis-inventory-edit";
const ACTIVE_TTL_MS = 30_000; // 30초 후 자동 expire

type EditMessage = {
  type: "labaxis-inventory-edit";
  productId: string;
  lotNumber: string | null;
  tabId: string;
  timestamp: number;
};

export interface InventoryEditBroadcastHandle {
  /** 다른 탭에서 같은 productId/lotNumber 작업 중 여부 */
  otherTabActive: boolean;
  /** 현재 탭이 작업 중임을 다른 탭에 broadcast */
  broadcast: (productId: string, lotNumber: string | null) => void;
  /** 사용자 ack — Info banner hide */
  acknowledge: () => void;
}

export function useInventoryEditBroadcast(): InventoryEditBroadcastHandle {
  const [otherTabActive, setOtherTabActive] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>("");
  const currentEditRef = useRef<{ productId: string; lotNumber: string | null } | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // SSR safe — BroadcastChannel 미지원 환경 (private mode 또는 구버전) graceful skip
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    // tabId 생성 (per-tab UUID) — crypto.randomUUID fallback Math.random
    tabIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<EditMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "labaxis-inventory-edit") return;
      // 자기 자신 메시지 skip
      if (msg.tabId === tabIdRef.current) return;
      // 현재 편집 중이 아니면 무시
      const current = currentEditRef.current;
      if (!current) return;
      // 같은 productId + lotNumber 시 active 표시
      if (
        msg.productId === current.productId &&
        msg.lotNumber === current.lotNumber
      ) {
        setOtherTabActive(true);
        setAcknowledged(false);
        // 30초 후 자동 expire (다른 탭 활동 정지 추정)
        if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
        expireTimerRef.current = setTimeout(() => {
          setOtherTabActive(false);
        }, ACTIVE_TTL_MS);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    };
  }, []);

  const broadcast = useCallback((productId: string, lotNumber: string | null) => {
    currentEditRef.current = { productId, lotNumber };
    const channel = channelRef.current;
    if (!channel) return;
    const msg: EditMessage = {
      type: "labaxis-inventory-edit",
      productId,
      lotNumber,
      tabId: tabIdRef.current,
      timestamp: Date.now(),
    };
    try {
      channel.postMessage(msg);
    } catch {
      // postMessage 실패 (channel closed 등) — silent fallback
    }
  }, []);

  const acknowledge = useCallback(() => {
    setAcknowledged(true);
    setOtherTabActive(false);
  }, []);

  return {
    otherTabActive: otherTabActive && !acknowledged,
    broadcast,
    acknowledge,
  };
}
