/**
 * 다세대 아카이브 (Multi-Generational Archive)
 *
 * 장기 보존 데이터를 HOT → WARM → COLD → GLACIER → PERPETUAL 계층으로 관리합니다.
 * 보존 정책 설정, 계층 간 마이그레이션, 통계 조회를 지원합니다.
 */

/** 아카이브 계층 */
export type ArchiveTier = "HOT" | "WARM" | "COLD" | "GLACIER" | "PERPETUAL";

/** 마이그레이션 이력 항목 */
export interface MigrationRecord {
  fromTier: ArchiveTier;
  toTier: ArchiveTier;
  migratedAt: Date;
  reason: string;
}

/** 아카이브 항목 */
export interface ArchiveEntry {
  id: string;
  tier: ArchiveTier;
  /** 아카이브 콘텐츠 */
  content: string;
  createdAt: Date;
  lastAccessedAt: Date;
  /** 보존 기간 (년) */
  retentionYears: number;
  /** 계층 마이그레이션 이력 */
  migrationHistory: MigrationRecord[];
}

/** 아카이브 통계 */
export interface ArchiveStats {
  totalEntries: number;
  byTier: Record<ArchiveTier, number>;
  averageRetentionYears: number;
  oldestEntryDate: Date | null;
  totalMigrations: number;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const archive: ArchiveEntry[] = [];

let nextId = 1;
function genId(): string {
  return `arc-${Date.now()}-${nextId++}`;
}

const TIER_ORDER: ArchiveTier[] = [
  "HOT",
  "WARM",
  "COLD",
  "GLACIER",
  "PERPETUAL",
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 콘텐츠를 아카이브에 등록합니다.
 * @param content 저장할 콘텐츠
 * @param tier 초기 계층
 * @param retentionYears 보존 기간 (년)
 */
export function archiveEntry(
  content: string,
  tier: ArchiveTier = "HOT",
  retentionYears: number = 5
): ArchiveEntry {
  const now = new Date();
  const entry: ArchiveEntry = {
    id: genId(),
    tier,
    content,
    createdAt: now,
    lastAccessedAt: now,
    retentionYears,
    migrationHistory: [],
  };
  archive.push(entry);
  return entry;
}

/**
 * 아카이브 항목을 조회합니다. 접근 시각을 갱신합니다.
 * @param entryId 항목 ID
 */
export function retrieveEntry(entryId: string): ArchiveEntry | null {
  const entry = archive.find((e) => e.id === entryId);
  if (!entry) return null;
  entry.lastAccessedAt = new Date();
  return entry;
}

/**
 * 항목을 다른 계층으로 마이그레이션합니다.
 * @param entryId 항목 ID
 * @param targetTier 대상 계층
 * @param reason 마이그레이션 사유
 */
export function migrateTier(
  entryId: string,
  targetTier: ArchiveTier,
  reason: string
): { success: boolean; entry: ArchiveEntry | null; message: string } {
  const entry = archive.find((e) => e.id === entryId);
  if (!entry) {
    return { success: false, entry: null, message: "항목을 찾을 수 없습니다." };
  }
  if (entry.tier === targetTier) {
    return { success: false, entry, message: "이미 동일 계층입니다." };
  }

  const record: MigrationRecord = {
    fromTier: entry.tier,
    toTier: targetTier,
    migratedAt: new Date(),
    reason,
  };
  entry.migrationHistory.push(record);
  entry.tier = targetTier;

  return { success: true, entry, message: `${record.fromTier} → ${targetTier} 마이그레이션 완료.` };
}

/**
 * 항목의 보존 정책을 설정합니다.
 * @param entryId 항목 ID
 * @param retentionYears 새 보존 기간 (년)
 */
export function setRetentionPolicy(
  entryId: string,
  retentionYears: number
): { success: boolean; message: string } {
  const entry = archive.find((e) => e.id === entryId);
  if (!entry) return { success: false, message: "항목을 찾을 수 없습니다." };
  if (retentionYears < 1) {
    return { success: false, message: "보존 기간은 최소 1년이어야 합니다." };
  }
  entry.retentionYears = retentionYears;
  return { success: true, message: `보존 기간이 ${retentionYears}년으로 설정되었습니다.` };
}

/**
 * 아카이브 전체 통계를 반환합니다.
 */
export function getArchiveStats(): ArchiveStats {
  const byTier: Record<ArchiveTier, number> = {
    HOT: 0,
    WARM: 0,
    COLD: 0,
    GLACIER: 0,
    PERPETUAL: 0,
  };

  let totalRetention = 0;
  let oldest: Date | null = null;
  let totalMigrations = 0;

  for (const entry of archive) {
    byTier[entry.tier]++;
    totalRetention += entry.retentionYears;
    totalMigrations += entry.migrationHistory.length;
    if (oldest === null || entry.createdAt < oldest) {
      oldest = entry.createdAt;
    }
  }

  return {
    totalEntries: archive.length,
    byTier,
    averageRetentionYears:
      archive.length === 0
        ? 0
        : Math.round((totalRetention / archive.length) * 100) / 100,
    oldestEntryDate: oldest,
    totalMigrations,
  };
}
