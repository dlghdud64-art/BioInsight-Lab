import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface AlternativeProduct {
  id: string;
  name: string;
  nameEn?: string;
  brand?: string;
  category: string;
  catalogNumber?: string;
  specification?: string;
  grade?: string;
  imageUrl?: string;
  minPrice?: number;
  similarity: number;
  similarityReasons: string[];
  vendors?: Array<{
    id: string;
    vendor: {
      id: string;
      name: string;
    };
    priceInKRW?: number;
    currency: string;
  }>;
}

// JSON 객체의 유사도 계산 (간단한 키 매칭)
function calculateSpecSimilarity(
  spec1: Record<string, any> | null,
  spec2: Record<string, any> | null
): number {
  if (!spec1 || !spec2) return 0;
  
  const keys1 = Object.keys(spec1);
  const keys2 = Object.keys(spec2);
  
  if (keys1.length === 0 || keys2.length === 0) return 0;
  
  // 공통 키 찾기
  const commonKeys = keys1.filter((k) => keys2.includes(k));
  if (commonKeys.length === 0) return 0;
  
  // 공통 키의 값이 유사한지 확인
  let matchingValues = 0;
  commonKeys.forEach((key) => {
    const val1 = String(spec1[key]).toLowerCase().trim();
    const val2 = String(spec2[key]).toLowerCase().trim();
    
    // 완전 일치
    if (val1 === val2) {
      matchingValues += 2;
    }
    // 부분 일치 (한쪽이 다른 쪽을 포함)
    else if (val1.includes(val2) || val2.includes(val1)) {
      matchingValues += 1;
    }
  });
  
  // 유사도 = (매칭 값 수) / (총 키 수)
  const totalKeys = Math.max(keys1.length, keys2.length);
  return matchingValues / (totalKeys * 2);
}

// 텍스트 유사도 계산 (간단한 키워드 매칭)
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter((w) => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "3");

    // 현재 제품 정보 가져오기
    const currentProduct = await db.product.findUnique({
      where: { id: productId },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          take: 1,
        },
      },
    });

    if (!currentProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 동일 카테고리 제품 검색 (현재 제품 제외)
    const candidates = await db.product.findMany({
      where: {
        category: currentProduct.category,
        id: { not: productId },
      },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          orderBy: {
            priceInKRW: "asc",
          },
          take: 1, // 최저가 벤더만
        },
      },
      take: 50, // 후보를 넓게 가져온 후 유사도로 필터링
    });

    // 각 후보에 대해 유사도 계산
    const alternatives: AlternativeProduct[] = [];

    for (const candidate of candidates) {
      let similarity = 0;
      const reasons: string[] = [];

      // 1. 벡터 유사도 (embedding이 있는 경우)
      if (currentProduct.embedding && candidate.embedding) {
        try {
          const embedding1 = currentProduct.embedding as unknown as number[];
          const embedding2 = candidate.embedding as unknown as number[];
          
          if (embedding1.length === embedding2.length) {
            // 코사인 유사도 계산
            let dotProduct = 0;
            let norm1 = 0;
            let norm2 = 0;
            
            for (let i = 0; i < embedding1.length; i++) {
              dotProduct += embedding1[i] * embedding2[i];
              norm1 += embedding1[i] * embedding1[i];
              norm2 += embedding2[i] * embedding2[i];
            }
            
            const cosineSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
            if (cosineSimilarity > 0.7) {
              similarity += cosineSimilarity * 0.4; // 40% 가중치
              reasons.push("유사한 제품 설명");
            }
          }
        } catch (error) {
          console.warn("Error calculating embedding similarity:", error);
        }
      }

      // 2. 스펙 유사도
      const specSimilarity = calculateSpecSimilarity(
        currentProduct.specifications as Record<string, any> | null,
        candidate.specifications as Record<string, any> | null
      );
      if (specSimilarity > 0.3) {
        similarity += specSimilarity * 0.3; // 30% 가중치
        reasons.push("유사한 스펙");
      }

      // 3. Grade/규격 유사도
      if (currentProduct.grade && candidate.grade) {
        if (currentProduct.grade === candidate.grade) {
          similarity += 0.15;
          reasons.push(`동일 Grade: ${currentProduct.grade}`);
        }
      }
      
      if (currentProduct.specification && candidate.specification) {
        const specTextSim = calculateTextSimilarity(
          currentProduct.specification,
          candidate.specification
        );
        if (specTextSim > 0.5) {
          similarity += specTextSim * 0.1;
          reasons.push("유사한 규격");
        }
      }

      // 4. 이름/설명 텍스트 유사도
      const nameSim = calculateTextSimilarity(
        currentProduct.name || "",
        candidate.name || ""
      );
      if (nameSim > 0.3) {
        similarity += nameSim * 0.1;
        if (reasons.length === 0) {
          reasons.push("유사한 제품명");
        }
      }

      // 유사도가 일정 수준 이상인 경우만 추가
      if (similarity > 0.2) {
        const minPrice = candidate.vendors?.[0]?.priceInKRW;
        
        alternatives.push({
          id: candidate.id,
          name: candidate.name,
          nameEn: candidate.nameEn || undefined,
          brand: candidate.brand || undefined,
          category: candidate.category,
          catalogNumber: candidate.catalogNumber || undefined,
          specification: candidate.specification || undefined,
          grade: candidate.grade || undefined,
          imageUrl: candidate.imageUrl || undefined,
          minPrice,
          similarity: Math.round(similarity * 100) / 100,
          similarityReasons: reasons.length > 0 ? reasons : ["동일 카테고리"],
          vendors: candidate.vendors.map((v: any) => ({
            id: v.id,
            vendor: {
              id: v.vendor.id,
              name: v.vendor.name,
            },
            priceInKRW: v.priceInKRW || undefined,
            currency: v.currency,
          })),
        });
      }
    }

    // 유사도 순으로 정렬하고 상위 N개만 반환
    alternatives.sort((a, b) => b.similarity - a.similarity);
    const topAlternatives = alternatives.slice(0, limit);

    return NextResponse.json({
      alternatives: topAlternatives,
      count: topAlternatives.length,
    });
  } catch (error) {
    console.error("Error finding alternative products:", error);
    return NextResponse.json(
      { error: "Failed to find alternative products" },
      { status: 500 }
    );
  }
}

