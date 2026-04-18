/**
 * offline/sync-manager.ts — 재연결 시 자동 동기화
 *
 * NetInfo로 네트워크 상태를 감시하고,
 * 오프라인→온라인 전환 시 mutation queue를 자동 flush.
 *
 * 원칙:
 * - 서버가 canonical truth
 * - 로컬은 cache + queue만
 * - conflict → server wins
 * - flush 완료 후 관련 query 캐시 invalidate
 */

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { flushMutationQueue, getPendingCount } from "./mutation-queue";
import { pruneExpiredCache } from "./cache";
import { AppState, AppStateStatus } from "react-native";

type SyncCallback = (result: {
  synced: number;
  failed: number;
  remaining: number;
}) => void;

let _isOnline = true;
let _isSyncing = false;
let _listeners: SyncCallback[] = [];
let _unsubscribeNetInfo: (() => void) | null = null;
let _unsubscribeAppState: (() => void) | null = null;

/**
 * 현재 온라인 상태
 */
export function isOnline(): boolean {
  return _isOnline;
}

/**
 * pending mutation 존재 여부
 */
export async function hasPendingSync(): Promise<boolean> {
  const count = await getPendingCount();
  return count > 0;
}

/**
 * sync 완료 콜백 등록
 */
export function onSyncComplete(callback: SyncCallback): () => void {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter((l) => l !== callback);
  };
}

/**
 * mutation queue flush 실행
 */
async function runSync() {
  if (_isSyncing || !_isOnline) return;

  _isSyncing = true;
  try {
    const result = await flushMutationQueue();

    // 리스너에 결과 알림
    for (const listener of _listeners) {
      try {
        listener(result);
      } catch {}
    }

    // 성공한 mutation이 있으면 만료 캐시 정리
    if (result.synced > 0) {
      await pruneExpiredCache();
    }
  } catch (err) {
    console.warn("[sync-manager] flush error:", err);
  } finally {
    _isSyncing = false;
  }
}

/**
 * 네트워크 상태 변경 핸들러
 */
function handleNetworkChange(state: NetInfoState) {
  const wasOffline = !_isOnline;
  _isOnline = !!state.isConnected;

  // 오프라인 → 온라인 전환 시 자동 sync
  if (wasOffline && _isOnline) {
    console.log("[sync-manager] Online detected. Flushing mutation queue...");
    runSync();
  }
}

/**
 * 앱 foreground 복귀 핸들러
 */
function handleAppStateChange(state: AppStateStatus) {
  if (state === "active" && _isOnline) {
    // foreground 복귀 시에도 pending sync 시도
    runSync();
  }
}

/**
 * SyncManager 시작.
 * 앱 시작 시 한 번만 호출.
 */
export function startSyncManager() {
  // NetInfo 구독
  if (!_unsubscribeNetInfo) {
    _unsubscribeNetInfo = NetInfo.addEventListener(handleNetworkChange);
  }

  // AppState 구독 (foreground 복귀 감지)
  if (!_unsubscribeAppState) {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    _unsubscribeAppState = () => subscription.remove();
  }

  // 초기 상태 확인 + pending sync
  NetInfo.fetch().then((state) => {
    _isOnline = !!state.isConnected;
    if (_isOnline) runSync();
  });
}

/**
 * SyncManager 중지.
 * 앱 종료 시 호출 (선택적).
 */
export function stopSyncManager() {
  if (_unsubscribeNetInfo) {
    _unsubscribeNetInfo();
    _unsubscribeNetInfo = null;
  }
  if (_unsubscribeAppState) {
    _unsubscribeAppState();
    _unsubscribeAppState = null;
  }
}

/**
 * 수동 sync 트리거 (pull-to-refresh 등)
 */
export async function triggerSync(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (!_isOnline) {
    return { synced: 0, failed: 0, remaining: await getPendingCount() };
  }
  _isSyncing = false; // 강제 재실행 허용
  return flushMutationQueue();
}
