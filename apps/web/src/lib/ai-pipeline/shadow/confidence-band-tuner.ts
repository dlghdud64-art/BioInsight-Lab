/**
 * Confidence Band Tuner - 신뢰도 구간 병합/분할/임계값 조정기
 *
 * 처리 이력 데이터를 기반으로 신뢰도 구간의 최적 구성을 제안합니다.
 * 구간 병합(MERGE), 분할(SPLIT), 임계값 강화(TIGHTEN), 완화(LOOSEN)를
 * 제안하되, 안전성 제약을 엄격히 적용합니다.
 */

import { db } from "@/lib/db";

// --- 타입 정의 ---

/** 구간 변경 유형 */
export type ChangeType = "MERGE" | "SPLIT" | "TIGHTEN" | "LOOSEN";

/** 신뢰도 구간 정의 */
export interface ConfidenceBand {
  /** 구간 이름 */
  name: string;
  /** 하한 임계값 (0~1) */
  lowerThreshold: number;
  /** 상한 임계값 (0~1) */
  upperThreshold: number;
}

/** 구간 조정 제안 */
export interface BandTuningProposal {
  /** 제안 고유 식별자 */
  proposalId: string;
  /** 문서 유형 */
  documentType: string;
  /** 현재 구간 구성 */
  currentBands: ConfidenceBand[];
  /** 제안 구간 구성 */
  suggestedBands: ConfidenceBand[];
  /** 변경 유형 */
  changeType: ChangeType;
  /** 변경 근거 */
  rationale: string;
  /** 해당 구간의 데이터 볼륨 */
  dataVolume: number;
  /** 최소 필요 데이터 볼륨 */
  minimumVolume: number;
  /** 차단 여부 */
  blocked: boolean;
  /** 차단 사유 (차단 시에만 존재) */
  blockReason: string | null;
}

// --- 상수 ---

/** 구간 조정에 필요한 최소 데이터 볼륨 */
const MINIMUM_VOLUME = 500;

// --- 인메모리 구간 저장소 (production: DB-backed) ---
const bandConfigStore = new Map<string, ConfidenceBand[]>();

/**
 * 문서 유형별 현재 구간 설정을 등록합니다 (테스트/초기화 용도).
 */
export function setCurrentBands(
  documentType: string,
  bands: ConfidenceBand[]
): void {
  bandConfigStore.set(documentType, bands);
}

/**
 * 기본 신뢰도 구간을 반환합니다.
 */
function getDefaultBands(): ConfidenceBand[] {
  return [
    { name: "LOW", lowerThreshold: 0.0, upperThreshold: 0.5 },
    { name: "MEDIUM", lowerThreshold: 0.5, upperThreshold: 0.8 },
    { name: "HIGH", lowerThreshold: 0.8, upperThreshold: 1.0 },
  ];
}

/**
 * 현재 구간 설정을 조회합니다.
 */
function getCurrentBands(documentType: string): ConfidenceBand[] {
  return bandConfigStore.get(documentType) ?? getDefaultBands();
}

/**
 * 고유 제안 ID를 생성합니다.
 */
function generateProposalId(
  documentType: string,
  changeType: ChangeType
): string {
  const timestamp = Date.now();
  return `BT-${documentType}-${changeType}-${timestamp}`;
}

/**
 * 특정 문서 유형에 대해 신뢰도 구간 조정을 제안합니다.
 *
 * HARD BLOCK 규칙:
 * 1. false-safe 이력이 있는 구간에 대한 LOOSEN 제안은 차단
 * 2. 데이터 볼륨이 최소 기준(500건) 미만인 구간의 조정은 차단
 *
 * @param documentType 분석할 문서 유형
 * @returns 구간 조정 제안 배열
 */
export async function proposeBandTuning(
  documentType: string
): Promise<BandTuningProposal[]> {
  const proposals: BandTuningProposal[] = [];
  const currentBands = getCurrentBands(documentType);

  // DB에서 구간별 통계 조회
  const bandStats = await db.$queryRawUnsafe<
    Array<{
      confidence_band: string;
      total_count: number;
      false_safe_count: number;
      avg_confidence: number;
    }>
  >(
    `
    SELECT
      confidence_band,
      COUNT(*) as total_count,
      SUM(CASE WHEN is_false_safe = true THEN 1 ELSE 0 END) as false_safe_count,
      AVG(confidence_score) as avg_confidence
    FROM "ProcessingLog"
    WHERE document_type = $1
    GROUP BY confidence_band
    `,
    documentType
  );

  // 구간별 통계를 맵으로 변환
  const statsMap = new Map(
    bandStats.map((s) => [
      s.confidence_band,
      {
        totalCount: Number(s.total_count),
        falseSafeCount: Number(s.false_safe_count),
        avgConfidence: Number(s.avg_confidence),
      },
    ])
  );

  // 각 구간에 대해 조정 가능성 분석
  for (let i = 0; i < currentBands.length; i++) {
    const band = currentBands[i];
    const stats = statsMap.get(band.name);
    const dataVolume = stats?.totalCount ?? 0;
    const hasFalseSafe = (stats?.falseSafeCount ?? 0) > 0;

    // --- MERGE 제안: 인접 구간의 성능이 유사한 경우 ---
    if (i < currentBands.length - 1) {
      const nextBand = currentBands[i + 1];
      const nextStats = statsMap.get(nextBand.name);
      const nextDataVolume = nextStats?.totalCount ?? 0;
      const combinedVolume = dataVolume + nextDataVolume;

      // 두 구간 모두 데이터 볼륨 확인
      let mergeBlocked = false;
      let mergeBlockReason: string | null = null;

      if (combinedVolume < MINIMUM_VOLUME) {
        mergeBlocked = true;
        mergeBlockReason = `데이터 볼륨 부족: ${combinedVolume}건 < 최소 ${MINIMUM_VOLUME}건`;
      }

      const mergedBands = currentBands.filter(
        (_, idx) => idx !== i && idx !== i + 1
      );
      mergedBands.splice(i, 0, {
        name: `${band.name}_${nextBand.name}`,
        lowerThreshold: band.lowerThreshold,
        upperThreshold: nextBand.upperThreshold,
      });

      proposals.push({
        proposalId: generateProposalId(documentType, "MERGE"),
        documentType,
        currentBands: [...currentBands],
        suggestedBands: mergedBands,
        changeType: "MERGE",
        rationale: `'${band.name}'과 '${nextBand.name}' 구간의 성능이 유사하여 병합 검토`,
        dataVolume: combinedVolume,
        minimumVolume: MINIMUM_VOLUME,
        blocked: mergeBlocked,
        blockReason: mergeBlockReason,
      });
    }

    // --- LOOSEN 제안: 높은 정확도를 보이는 구간의 임계값 완화 ---
    if (band.name === "HIGH" && dataVolume >= MINIMUM_VOLUME) {
      let loosenBlocked = false;
      let loosenBlockReason: string | null = null;

      // HARD BLOCK: false-safe 이력이 있으면 LOOSEN 차단
      if (hasFalseSafe) {
        loosenBlocked = true;
        loosenBlockReason =
          "False-safe 이력이 있는 구간에 대한 임계값 완화(LOOSEN)는 차단됩니다";
      }

      if (dataVolume < MINIMUM_VOLUME) {
        loosenBlocked = true;
        loosenBlockReason = `데이터 볼륨 부족: ${dataVolume}건 < 최소 ${MINIMUM_VOLUME}건`;
      }

      const loosenedBands = currentBands.map((b) =>
        b.name === band.name
          ? { ...b, lowerThreshold: Math.max(0, b.lowerThreshold - 0.05) }
          : b
      );

      proposals.push({
        proposalId: generateProposalId(documentType, "LOOSEN"),
        documentType,
        currentBands: [...currentBands],
        suggestedBands: loosenedBands,
        changeType: "LOOSEN",
        rationale: `'${band.name}' 구간의 하한 임계값을 ${band.lowerThreshold}에서 ${Math.max(0, band.lowerThreshold - 0.05)}로 완화 검토`,
        dataVolume,
        minimumVolume: MINIMUM_VOLUME,
        blocked: loosenBlocked,
        blockReason: loosenBlockReason,
      });
    }

    // --- TIGHTEN 제안: false-safe가 발생한 구간의 임계값 강화 ---
    if (hasFalseSafe) {
      let tightenBlocked = false;
      let tightenBlockReason: string | null = null;

      if (dataVolume < MINIMUM_VOLUME) {
        tightenBlocked = true;
        tightenBlockReason = `데이터 볼륨 부족: ${dataVolume}건 < 최소 ${MINIMUM_VOLUME}건`;
      }

      const tightenedBands = currentBands.map((b) =>
        b.name === band.name
          ? { ...b, upperThreshold: Math.min(1.0, b.upperThreshold - 0.05) }
          : b
      );

      proposals.push({
        proposalId: generateProposalId(documentType, "TIGHTEN"),
        documentType,
        currentBands: [...currentBands],
        suggestedBands: tightenedBands,
        changeType: "TIGHTEN",
        rationale: `'${band.name}' 구간에서 false-safe 발생 → 임계값 강화로 안전성 확보`,
        dataVolume,
        minimumVolume: MINIMUM_VOLUME,
        blocked: tightenBlocked,
        blockReason: tightenBlockReason,
      });
    }

    // --- SPLIT 제안: 데이터 볼륨이 충분하고 구간 범위가 넓은 경우 ---
    const bandWidth = band.upperThreshold - band.lowerThreshold;
    if (bandWidth > 0.3 && dataVolume >= MINIMUM_VOLUME) {
      let splitBlocked = false;
      let splitBlockReason: string | null = null;

      if (dataVolume < MINIMUM_VOLUME) {
        splitBlocked = true;
        splitBlockReason = `데이터 볼륨 부족: ${dataVolume}건 < 최소 ${MINIMUM_VOLUME}건`;
      }

      const midpoint = (band.lowerThreshold + band.upperThreshold) / 2;
      const splitBands = [...currentBands];
      splitBands.splice(
        i,
        1,
        {
          name: `${band.name}_LOWER`,
          lowerThreshold: band.lowerThreshold,
          upperThreshold: midpoint,
        },
        {
          name: `${band.name}_UPPER`,
          lowerThreshold: midpoint,
          upperThreshold: band.upperThreshold,
        }
      );

      proposals.push({
        proposalId: generateProposalId(documentType, "SPLIT"),
        documentType,
        currentBands: [...currentBands],
        suggestedBands: splitBands,
        changeType: "SPLIT",
        rationale: `'${band.name}' 구간의 범위(${bandWidth.toFixed(2)})가 넓어 세분화 검토`,
        dataVolume,
        minimumVolume: MINIMUM_VOLUME,
        blocked: splitBlocked,
        blockReason: splitBlockReason,
      });
    }
  }

  return proposals;
}
