import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 개인화 추천 API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!session?.user?.id) {
      // 비로그인 사용자는 기본 추천 반환
      return NextResponse.json({ recommendations: [] });
    }

    const userId = session.user.id;

    // 1. 사용자 검색 기록 분석
    const searchHistory = await db.searchHistory.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 최근 90일
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // 2. 사용자 선호도 분석
    const preferences = analyzeUserPreferences(searchHistory);

    // 3. 비교/견적 이력 분석
    const comparisons = await db.comparison.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    const quoteItems = await db.quoteItem.findMany({
      where: {
        quote: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        quote: true,
      },
    });

    // 4. 즐겨찾기 분석
    const favorites = await db.favorite.findMany({
      where: {
        userId,
      },
      include: {
        product: true,
      },
    });

    // 5. 추천 제품 계산
    const recommendations = await generatePersonalizedRecommendations({
      userId,
      preferences,
      comparisons,
      quoteItems,
      favorites,
      currentProductId: productId,
      limit,
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error generating personalized recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

// 사용자 선호도 분석
function analyzeUserPreferences(searchHistory: any[]) {
  const preferences = {
    categories: {} as Record<string, number>,
    brands: {} as Record<string, number>,
    priceRange: { min: Infinity, max: 0 },
    clickedProducts: [] as string[],
  };

  searchHistory.forEach((search) => {
    if (search.category) {
      preferences.categories[search.category] = (preferences.categories[search.category] || 0) + 1;
    }

    if (search.clickedProductId) {
      preferences.clickedProducts.push(search.clickedProductId);
    }

    if (search.product?.brand) {
      preferences.brands[search.product.brand] = (preferences.brands[search.product.brand] || 0) + 1;
    }
  });

  return preferences;
}

// 개인화 추천 생성
async function generatePersonalizedRecommendations(params: {
  userId: string;
  preferences: any;
  comparisons: any[];
  quoteItems: any[];
  favorites: any[];
  currentProductId: string | null;
  limit: number;
}) {
  const { preferences, currentProductId, limit } = params;

  // 선호 카테고리 추출
  const topCategories = Object.entries(preferences.categories)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([category]) => category);

  // 선호 브랜드 추출
  const topBrands = Object.entries(preferences.brands)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([brand]) => brand);

  // 추천 제품 쿼리
  const where: any = {};

  if (topCategories.length > 0) {
    where.category = { in: topCategories };
  }

  if (topBrands.length > 0) {
    where.brand = { in: topBrands };
  }

  // 현재 제품 제외
  if (currentProductId) {
    where.id = { not: currentProductId };
  }

  // 클릭한 제품 제외
  if (preferences.clickedProducts.length > 0) {
    where.id = {
      ...where.id,
      notIn: preferences.clickedProducts,
    };
  }

  const recommendedProducts = await db.product.findMany({
    where,
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
    take: limit * 2, // 더 많이 가져와서 필터링
    orderBy: {
      createdAt: "desc",
    },
  });

  // 점수 계산 및 정렬
  const scoredProducts = recommendedProducts.map((product) => {
    let score = 0;

    // 카테고리 매칭 점수
    if (topCategories.includes(product.category)) {
      score += preferences.categories[product.category] || 0;
    }

    // 브랜드 매칭 점수
    if (product.brand && topBrands.includes(product.brand)) {
      score += preferences.brands[product.brand] || 0;
    }

    return {
      ...product,
      recommendationScore: score,
      reason: generateRecommendationReason(product, preferences),
    };
  });

  // 점수순 정렬 및 상위 N개 반환
  return scoredProducts
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit)
    .map(({ recommendationScore, reason, ...product }) => ({
      product,
      score: recommendationScore,
      reason,
    }));
}

// 추천 근거 생성
function generateRecommendationReason(product: any, preferences: any): string {
  const reasons: string[] = [];

  if (preferences.categories[product.category]) {
    reasons.push(`이 카테고리를 자주 검색하셨습니다`);
  }

  if (product.brand && preferences.brands[product.brand]) {
    reasons.push(`${product.brand} 브랜드를 선호하시는 것으로 보입니다`);
  }

  return reasons.length > 0 ? reasons.join(", ") : "유사한 제품입니다";
}


import { db } from "@/lib/db";

// 개인화 추천 API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!session?.user?.id) {
      // 비로그인 사용자는 기본 추천 반환
      return NextResponse.json({ recommendations: [] });
    }

    const userId = session.user.id;

    // 1. 사용자 검색 기록 분석
    const searchHistory = await db.searchHistory.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 최근 90일
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // 2. 사용자 선호도 분석
    const preferences = analyzeUserPreferences(searchHistory);

    // 3. 비교/견적 이력 분석
    const comparisons = await db.comparison.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    const quoteItems = await db.quoteItem.findMany({
      where: {
        quote: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        quote: true,
      },
    });

    // 4. 즐겨찾기 분석
    const favorites = await db.favorite.findMany({
      where: {
        userId,
      },
      include: {
        product: true,
      },
    });

    // 5. 추천 제품 계산
    const recommendations = await generatePersonalizedRecommendations({
      userId,
      preferences,
      comparisons,
      quoteItems,
      favorites,
      currentProductId: productId,
      limit,
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error generating personalized recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

// 사용자 선호도 분석
function analyzeUserPreferences(searchHistory: any[]) {
  const preferences = {
    categories: {} as Record<string, number>,
    brands: {} as Record<string, number>,
    priceRange: { min: Infinity, max: 0 },
    clickedProducts: [] as string[],
  };

  searchHistory.forEach((search) => {
    if (search.category) {
      preferences.categories[search.category] = (preferences.categories[search.category] || 0) + 1;
    }

    if (search.clickedProductId) {
      preferences.clickedProducts.push(search.clickedProductId);
    }

    if (search.product?.brand) {
      preferences.brands[search.product.brand] = (preferences.brands[search.product.brand] || 0) + 1;
    }
  });

  return preferences;
}

// 개인화 추천 생성
async function generatePersonalizedRecommendations(params: {
  userId: string;
  preferences: any;
  comparisons: any[];
  quoteItems: any[];
  favorites: any[];
  currentProductId: string | null;
  limit: number;
}) {
  const { preferences, currentProductId, limit } = params;

  // 선호 카테고리 추출
  const topCategories = Object.entries(preferences.categories)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([category]) => category);

  // 선호 브랜드 추출
  const topBrands = Object.entries(preferences.brands)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([brand]) => brand);

  // 추천 제품 쿼리
  const where: any = {};

  if (topCategories.length > 0) {
    where.category = { in: topCategories };
  }

  if (topBrands.length > 0) {
    where.brand = { in: topBrands };
  }

  // 현재 제품 제외
  if (currentProductId) {
    where.id = { not: currentProductId };
  }

  // 클릭한 제품 제외
  if (preferences.clickedProducts.length > 0) {
    where.id = {
      ...where.id,
      notIn: preferences.clickedProducts,
    };
  }

  const recommendedProducts = await db.product.findMany({
    where,
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
    take: limit * 2, // 더 많이 가져와서 필터링
    orderBy: {
      createdAt: "desc",
    },
  });

  // 점수 계산 및 정렬
  const scoredProducts = recommendedProducts.map((product) => {
    let score = 0;

    // 카테고리 매칭 점수
    if (topCategories.includes(product.category)) {
      score += preferences.categories[product.category] || 0;
    }

    // 브랜드 매칭 점수
    if (product.brand && topBrands.includes(product.brand)) {
      score += preferences.brands[product.brand] || 0;
    }

    return {
      ...product,
      recommendationScore: score,
      reason: generateRecommendationReason(product, preferences),
    };
  });

  // 점수순 정렬 및 상위 N개 반환
  return scoredProducts
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit)
    .map(({ recommendationScore, reason, ...product }) => ({
      product,
      score: recommendationScore,
      reason,
    }));
}

// 추천 근거 생성
function generateRecommendationReason(product: any, preferences: any): string {
  const reasons: string[] = [];

  if (preferences.categories[product.category]) {
    reasons.push(`이 카테고리를 자주 검색하셨습니다`);
  }

  if (product.brand && preferences.brands[product.brand]) {
    reasons.push(`${product.brand} 브랜드를 선호하시는 것으로 보입니다`);
  }

  return reasons.length > 0 ? reasons.join(", ") : "유사한 제품입니다";
}


import { db } from "@/lib/db";

// 개인화 추천 API
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!session?.user?.id) {
      // 비로그인 사용자는 기본 추천 반환
      return NextResponse.json({ recommendations: [] });
    }

    const userId = session.user.id;

    // 1. 사용자 검색 기록 분석
    const searchHistory = await db.searchHistory.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 최근 90일
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // 2. 사용자 선호도 분석
    const preferences = analyzeUserPreferences(searchHistory);

    // 3. 비교/견적 이력 분석
    const comparisons = await db.comparison.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        products: {
          include: {
            product: true,
          },
        },
      },
    });

    const quoteItems = await db.quoteItem.findMany({
      where: {
        quote: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        quote: true,
      },
    });

    // 4. 즐겨찾기 분석
    const favorites = await db.favorite.findMany({
      where: {
        userId,
      },
      include: {
        product: true,
      },
    });

    // 5. 추천 제품 계산
    const recommendations = await generatePersonalizedRecommendations({
      userId,
      preferences,
      comparisons,
      quoteItems,
      favorites,
      currentProductId: productId,
      limit,
    });

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("Error generating personalized recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

// 사용자 선호도 분석
function analyzeUserPreferences(searchHistory: any[]) {
  const preferences = {
    categories: {} as Record<string, number>,
    brands: {} as Record<string, number>,
    priceRange: { min: Infinity, max: 0 },
    clickedProducts: [] as string[],
  };

  searchHistory.forEach((search) => {
    if (search.category) {
      preferences.categories[search.category] = (preferences.categories[search.category] || 0) + 1;
    }

    if (search.clickedProductId) {
      preferences.clickedProducts.push(search.clickedProductId);
    }

    if (search.product?.brand) {
      preferences.brands[search.product.brand] = (preferences.brands[search.product.brand] || 0) + 1;
    }
  });

  return preferences;
}

// 개인화 추천 생성
async function generatePersonalizedRecommendations(params: {
  userId: string;
  preferences: any;
  comparisons: any[];
  quoteItems: any[];
  favorites: any[];
  currentProductId: string | null;
  limit: number;
}) {
  const { preferences, currentProductId, limit } = params;

  // 선호 카테고리 추출
  const topCategories = Object.entries(preferences.categories)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([category]) => category);

  // 선호 브랜드 추출
  const topBrands = Object.entries(preferences.brands)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([brand]) => brand);

  // 추천 제품 쿼리
  const where: any = {};

  if (topCategories.length > 0) {
    where.category = { in: topCategories };
  }

  if (topBrands.length > 0) {
    where.brand = { in: topBrands };
  }

  // 현재 제품 제외
  if (currentProductId) {
    where.id = { not: currentProductId };
  }

  // 클릭한 제품 제외
  if (preferences.clickedProducts.length > 0) {
    where.id = {
      ...where.id,
      notIn: preferences.clickedProducts,
    };
  }

  const recommendedProducts = await db.product.findMany({
    where,
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
    take: limit * 2, // 더 많이 가져와서 필터링
    orderBy: {
      createdAt: "desc",
    },
  });

  // 점수 계산 및 정렬
  const scoredProducts = recommendedProducts.map((product) => {
    let score = 0;

    // 카테고리 매칭 점수
    if (topCategories.includes(product.category)) {
      score += preferences.categories[product.category] || 0;
    }

    // 브랜드 매칭 점수
    if (product.brand && topBrands.includes(product.brand)) {
      score += preferences.brands[product.brand] || 0;
    }

    return {
      ...product,
      recommendationScore: score,
      reason: generateRecommendationReason(product, preferences),
    };
  });

  // 점수순 정렬 및 상위 N개 반환
  return scoredProducts
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit)
    .map(({ recommendationScore, reason, ...product }) => ({
      product,
      score: recommendationScore,
      reason,
    }));
}

// 추천 근거 생성
function generateRecommendationReason(product: any, preferences: any): string {
  const reasons: string[] = [];

  if (preferences.categories[product.category]) {
    reasons.push(`이 카테고리를 자주 검색하셨습니다`);
  }

  if (product.brand && preferences.brands[product.brand]) {
    reasons.push(`${product.brand} 브랜드를 선호하시는 것으로 보입니다`);
  }

  return reasons.length > 0 ? reasons.join(", ") : "유사한 제품입니다";
}

