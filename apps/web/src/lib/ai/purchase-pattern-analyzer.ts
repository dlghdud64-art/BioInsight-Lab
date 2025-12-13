import { db } from "@/lib/db";

/**
 * 자주 함께 구매되는 품목 패턴 분석
 */
export interface PurchasePattern {
  productIds: string[];
  frequency: number; // 함께 구매된 횟수
  confidence: number; // 신뢰도 (0-1)
  support: number; // 지지도 (0-1)
}

/**
 * 구매 내역에서 자주 함께 구매되는 품목 패턴 분석
 */
export async function analyzePurchasePatterns(params: {
  organizationId?: string;
  minFrequency?: number; // 최소 빈도 (기본값: 2)
  limit?: number; // 반환할 패턴 수 (기본값: 20)
}): Promise<PurchasePattern[]> {
  const { organizationId, minFrequency = 2, limit = 20 } = params;

  try {
    // 구매 내역 조회
    const purchaseRecords = await db.purchaseRecord.findMany({
      where: {
        ...(organizationId && { organizationId }),
        productId: { not: null },
      },
      include: {
        product: true,
      },
      orderBy: {
        purchaseDate: "desc",
      },
    });

    // 같은 날짜/프로젝트/견적에서 구매된 제품 그룹화
    const purchaseGroups = new Map<string, string[]>();
    
    purchaseRecords.forEach((record: any) => {
      if (!record.productId) return;
      
      // 그룹 키 생성 (같은 날짜, 프로젝트, 견적에서 구매된 것들)
      const groupKey = [
        record.purchaseDate.toISOString().split("T")[0], // 날짜
        record.projectName || "",
        record.quoteId || "",
      ].join("|");
      
      if (!purchaseGroups.has(groupKey)) {
        purchaseGroups.set(groupKey, []);
      }
      purchaseGroups.get(groupKey)!.push(record.productId);
    });

    // 제품 쌍 빈도 계산
    const pairFrequency = new Map<string, number>();
    const productFrequency = new Map<string, number>();

    purchaseGroups.forEach((productIds) => {
      // 중복 제거
      const uniqueIds = Array.from(new Set(productIds));
      
      // 각 제품의 빈도 계산
      uniqueIds.forEach((id) => {
        productFrequency.set(id, (productFrequency.get(id) || 0) + 1);
      });

      // 제품 쌍 빈도 계산
      for (let i = 0; i < uniqueIds.length; i++) {
        for (let j = i + 1; j < uniqueIds.length; j++) {
          const pair = [uniqueIds[i], uniqueIds[j]].sort().join(",");
          pairFrequency.set(pair, (pairFrequency.get(pair) || 0) + 1);
        }
      }
    });

    // 패턴 생성 및 점수 계산
    const patterns: PurchasePattern[] = [];

    pairFrequency.forEach((frequency, pairKey) => {
      if (frequency < minFrequency) return;

      const [productId1, productId2] = pairKey.split(",");
      const freq1 = productFrequency.get(productId1) || 0;
      const freq2 = productFrequency.get(productId2) || 0;

      // 신뢰도: P(B|A) = P(A and B) / P(A)
      const confidence = freq1 > 0 ? frequency / freq1 : 0;
      
      // 지지도: P(A and B)
      const totalGroups = purchaseGroups.size;
      const support = totalGroups > 0 ? frequency / totalGroups : 0;

      patterns.push({
        productIds: [productId1, productId2],
        frequency,
        confidence,
        support,
      });
    });

    // 신뢰도와 지지도 기반 정렬
    return patterns
      .sort((a, b) => {
        // 신뢰도 * 지지도 * 빈도로 점수 계산
        const scoreA = a.confidence * a.support * a.frequency;
        const scoreB = b.confidence * b.support * b.frequency;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Error analyzing purchase patterns:", error);
    return [];
  }
}

/**
 * 견적 내역에서 자주 함께 요청되는 품목 패턴 분석
 */
export async function analyzeQuotePatterns(params: {
  organizationId?: string;
  userId?: string;
  minFrequency?: number;
  limit?: number;
}): Promise<PurchasePattern[]> {
  const { organizationId, userId, minFrequency = 2, limit = 20 } = params;

  try {
    // 견적 조회
    const quotes = await db.quote.findMany({
      where: {
        ...(organizationId && { organizationId }),
        ...(userId && { userId }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 제품 쌍 빈도 계산
    const pairFrequency = new Map<string, number>();
    const productFrequency = new Map<string, number>();

    quotes.forEach((quote: any) => {
      const productIds = quote.items.map((item: any) => item.productId);
      const uniqueIds = Array.from(new Set(productIds)) as string[];

      // 각 제품의 빈도 계산
      uniqueIds.forEach((id: string) => {
        productFrequency.set(id, (productFrequency.get(id) || 0) + 1);
      });

      // 제품 쌍 빈도 계산
      for (let i = 0; i < uniqueIds.length; i++) {
        for (let j = i + 1; j < uniqueIds.length; j++) {
          const pair = [uniqueIds[i], uniqueIds[j]].sort().join(",");
          pairFrequency.set(pair, (pairFrequency.get(pair) || 0) + 1);
        }
      }
    });

    // 패턴 생성
    const patterns: PurchasePattern[] = [];

    pairFrequency.forEach((frequency, pairKey) => {
      if (frequency < minFrequency) return;

      const [productId1, productId2] = pairKey.split(",");
      const freq1 = productFrequency.get(productId1) || 0;
      const freq2 = productFrequency.get(productId2) || 0;

      const confidence = freq1 > 0 ? frequency / freq1 : 0;
      const totalQuotes = quotes.length;
      const support = totalQuotes > 0 ? frequency / totalQuotes : 0;

      patterns.push({
        productIds: [productId1, productId2],
        frequency,
        confidence,
        support,
      });
    });

    return patterns
      .sort((a, b) => {
        const scoreA = a.confidence * a.support * a.frequency;
        const scoreB = b.confidence * b.support * b.frequency;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  } catch (error) {
    console.error("Error analyzing quote patterns:", error);
    return [];
  }
}

/**
 * 특정 제품과 자주 함께 구매되는 제품 추천
 */
export async function getFrequentlyBoughtTogether(
  productId: string,
  params: {
    organizationId?: string;
    limit?: number;
  }
): Promise<Array<{ productId: string; score: number; reason: string }>> {
  const { organizationId, limit = 5 } = params;

  try {
    // 구매 패턴 분석
    const purchasePatterns = await analyzePurchasePatterns({
      organizationId,
      minFrequency: 2,
      limit: 50,
    });

    // 견적 패턴 분석
    const quotePatterns = await analyzeQuotePatterns({
      organizationId,
      minFrequency: 2,
      limit: 50,
    });

    // 두 패턴 합치기
    const allPatterns = [...purchasePatterns, ...quotePatterns];

    // 해당 제품과 관련된 패턴 찾기
    const relatedPatterns = allPatterns.filter((pattern) =>
      pattern.productIds.includes(productId)
    );

    // 관련 제품 점수 계산
    const productScores = new Map<string, { score: number; frequency: number }>();

    relatedPatterns.forEach((pattern) => {
      const otherProductId = pattern.productIds.find((id) => id !== productId);
      if (!otherProductId) return;

      const current = productScores.get(otherProductId) || { score: 0, frequency: 0 };
      const patternScore = pattern.confidence * pattern.support * pattern.frequency;
      
      productScores.set(otherProductId, {
        score: current.score + patternScore,
        frequency: current.frequency + pattern.frequency,
      });
    });

    // 점수순 정렬
    const recommendations = Array.from(productScores.entries())
      .map(([productId, data]) => ({
        productId,
        score: data.score,
        frequency: data.frequency,
        reason: `${data.frequency}번 함께 구매/견적 요청되었습니다`,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  } catch (error) {
    console.error("Error getting frequently bought together:", error);
    return [];
  }
}



