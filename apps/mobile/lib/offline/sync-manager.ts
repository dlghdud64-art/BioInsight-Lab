/**
 * offline/sync-manager.ts — 확인 후 동기화
 *
 * NetInfo로 네트워크 상태만 감시한다.
 * 대기 중인 변경은 사용자가 확인 버튼을 누른 경우에만 서버에 반영한다.
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

type SyncCallback = (result: {
  synced: number;
  failed: number;
  remaining: number;
}) => void;
type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

let _isOnline = true;
let _isSyncing = false;
let _listeners: SyncCallback[] = [];
let _unsubscribeNetInfo: (() => void) | null = null;

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
async function runSync(): Promise<SyncResult> {
  if (_isSyncing || !_isOnline) {
    return { synced: 0, failed: 0, remaining: await getPendingCount() };
  }

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
    return result;
  } catch (err) {
    console.warn("[sync-manager] flush error:", err);
    return { synced: 0, failed: 0, remaining: await getPendingCount() };
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

  // 연결 복구만 알린다. 서버 반영은 화면의 확인 CTA가 담당한다.
  if (wasOffline && _isOnline) {
    console.log("[sync-manager] Online detected. Pending changes require confirmation.");
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

  // 초기 상태만 확인한다. 대기 변경은 사용자 동의 없이 반영하지 않는다.
  NetInfo.fetch().then((state) => {
    _isOnline = !!state.isConnected;
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
}

/**
 * 사용자가 확인한 뒤 실행하는 동기화 트리거.
 */
export async function triggerSync(): Promise<SyncResult> {
  if (!_isOnline) {
    return { synced: 0, failed: 0, remaining: await getPendingCount() };
  }
  return runSync();
}
