/**
 * offline/db.ts — SQLite 로컬 DB 초기화 + 스키마
 *
 * 원칙:
 * - 서버가 canonical truth, 모바일은 cache + pending queue만 담당
 * - 로컬 DB는 읽기 캐시 + 오프라인 mutation 대기열 용도
 * - sync 시 서버 응답이 항상 우선 (conflict → server wins)
 *
 * 테이블:
 * 1. cache_entries — API 응답 캐시 (key-value, TTL 기반)
 * 2. mutation_queue — 오프라인 mutation 대기열 (FIFO)
 * 3. sync_meta — 마지막 동기화 시점 추적
 */

import * as SQLite from "expo-sqlite";

const DB_NAME = "bioinsight_offline.db";

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * SQLite DB 인스턴스를 가져옵니다.
 * 최초 호출 시 테이블을 생성합니다.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync(DB_NAME);

  // WAL 모드 활성화 (동시 읽기/쓰기 성능 향상)
  await _db.execAsync("PRAGMA journal_mode = WAL;");

  // 스키마 생성
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      ttl_ms INTEGER NOT NULL DEFAULT 300000
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'POST',
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      entity_type TEXT,
      entity_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      last_synced_at INTEGER NOT NULL,
      server_version TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_mutation_status ON mutation_queue(status);
    CREATE INDEX IF NOT EXISTS idx_cache_ttl ON cache_entries(cached_at, ttl_ms);
  `);

  return _db;
}

/**
 * DB 닫기 (앱 종료 시)
 */
export async function closeDb() {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}
