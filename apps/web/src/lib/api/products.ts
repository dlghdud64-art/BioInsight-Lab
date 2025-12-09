import { db, isPrismaAvailable } from "@/lib/db";
import { cache, createCacheKey } from "@/lib/cache";
import { convertToKRW } from "@/lib/api/exchange-rate";
import { getEmbedding } from "@/lib/ai/embeddings";
import type { ProductCategory } from "@/types";

export interface SearchProductsParams {
  query?: string;
  category?: ProductCategory;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_low" | "price_high" | "lead_time" | "review";
  page?: number;
  limit?: number;
}

export async function searchProducts(params: SearchProductsParams) {
  const {
    query,
    category,
    brand,
    minPrice,
    maxPrice,
    sortBy = "relevance",
    page = 1,
    limit = 20,
  } = params;

  // 캐시 키 생성
  const cacheKey = createCacheKey(
    "search-products",
    query || "",
    category || "",
    brand || "",
    minPrice || 0,
    maxPrice || 0,
    sortBy,
    page,
    limit
  );

  // 캐시 확인 (검색 결과는 5분 TTL로 연장)
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const skip = (page - 1) * limit;

  // 기본 필터 조건
  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (brand) {
    where.brand = brand;
  }

  // 텍스트 검색 + 벡터 검색 (하이브리드)
  let vectorSearchProductIds: string[] = [];
  
  if (query) {
    // 텍스트 검색 조건
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { nameEn: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { descriptionEn: { contains: query, mode: "insensitive" } },
    ];

    // 벡터 검색 시도 (pgvector가 활성화된 경우)
    try {
      const embedding = await getEmbedding(query);
      if (embedding) {
        // pgvector를 사용한 유사도 검색
        // Prisma는 직접 벡터 검색을 지원하지 않으므로 raw query 사용
        const embeddingArray = `[${embedding.join(",")}]`;
        const vectorResults = (await db.$queryRawUnsafe(
          `SELECT id, 1 - (embedding <=> $1::vector) as similarity
           FROM "Product"
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT 50`,
          embeddingArray
        )) as Array<{ id: string; similarity: number }>;
        
        vectorSearchProductIds = vectorResults.map((r) => r.id);
      }
    } catch (error) {
      // pgvector가 활성화되지 않았거나 에러가 발생한 경우 텍스트 검색만 사용
      console.warn("Vector search failed, using text search only:", error);
    }
  }

  // 가격 필터 (ProductVendor를 통한 필터링)
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.vendors = {
      some: {
        priceInKRW: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      },
    };
  }

  // 벡터 검색 결과가 있으면 우선순위 부여
  if (vectorSearchProductIds.length > 0 && query) {
    // 벡터 검색 결과를 우선적으로 포함
    where.OR = [
      ...(where.OR || []),
      { id: { in: vectorSearchProductIds } },
    ];
  }

  // 정렬
  let orderBy: any = {};
  switch (sortBy) {
    case "price_low":
      orderBy = { vendors: { _min: { priceInKRW: "asc" } } };
      break;
    case "price_high":
      orderBy = { vendors: { _min: { priceInKRW: "desc" } } };
      break;
    case "lead_time":
      orderBy = { vendors: { _min: { leadTime: "asc" } } };
      break;
    case "relevance":
    default:
      // 벡터 검색 결과가 있으면 유사도 순으로 정렬
      if (vectorSearchProductIds.length > 0 && query) {
        // Prisma는 직접 지원하지 않으므로 클라이언트 측에서 정렬
        // 또는 raw query 사용
        orderBy = { createdAt: "desc" };
      } else {
        orderBy = { createdAt: "desc" };
      }
      break;
  }

  let products: any[] = [];
  let total = 0;

  // Prisma Client가 없으면 바로 샘플 데이터 반환
  // 간단하게 isPrismaAvailable이 false이거나 db가 더미인지 확인
  const useSampleData = !isPrismaAvailable || !db || typeof db.product?.findMany !== 'function';

  if (useSampleData) {
    console.warn("⚠️ Prisma Client not available, returning sample data");
      
      // 검색어에 따라 샘플 데이터 필터링
      const sampleProducts = [
        {
          id: "product-elisa-1",
          name: "Human IL-6 ELISA Kit",
          nameEn: "Human IL-6 ELISA Kit",
          description: "인간 인터루킨-6 (IL-6) 정량 분석용 ELISA 키트",
          descriptionEn: "ELISA kit for quantitative analysis of human interleukin-6 (IL-6)",
          category: "REAGENT",
          brand: "R&D Systems",
          modelNumber: "D6050",
          catalogNumber: "D6050",
          vendors: [{
            id: "pv-elisa-1",
            price: 450.0,
            currency: "USD",
            priceInKRW: 585000,
            stockStatus: "In Stock",
            leadTime: 7,
            vendor: { name: "Bio-Rad", nameEn: "Bio-Rad" }
          }],
        },
        {
          id: "product-filter-1",
          name: "0.22μm 멸균 필터",
          nameEn: "0.22μm Sterile Filter",
          description: "세포 배양액 및 시약 멸균용 0.22μm 멸균 필터",
          descriptionEn: "0.22μm sterile filter for cell culture media and reagent sterilization",
          category: "TOOL",
          brand: "Millipore",
          modelNumber: "SLGP033RS",
          catalogNumber: "SLGP033RS",
          vendors: [{
            id: "pv-filter-1",
            price: 120.0,
            currency: "USD",
            priceInKRW: 156000,
            stockStatus: "In Stock",
            leadTime: 5,
            vendor: { name: "Sigma-Aldrich", nameEn: "Sigma-Aldrich" }
          }],
        },
        {
          id: "product-hplc-1",
          name: "HPLC C18 컬럼",
          nameEn: "HPLC C18 Column",
          description: "역상 HPLC 분석용 C18 컬럼",
          descriptionEn: "C18 column for reverse-phase HPLC analysis",
          category: "EQUIPMENT",
          brand: "Waters",
          modelNumber: "186002350",
          catalogNumber: "186002350",
          vendors: [{
            id: "pv-hplc-1",
            price: 850.0,
            currency: "USD",
            priceInKRW: 1105000,
            stockStatus: "In Stock",
            leadTime: 14,
            vendor: { name: "Sigma-Aldrich", nameEn: "Sigma-Aldrich" }
          }],
        },
      ];

      // 검색어 필터링
      if (query) {
        const lowerQuery = query.toLowerCase();
        products = sampleProducts.filter(p => 
          p.name.toLowerCase().includes(lowerQuery) ||
          p.nameEn.toLowerCase().includes(lowerQuery) ||
          p.description?.toLowerCase().includes(lowerQuery) ||
          p.descriptionEn?.toLowerCase().includes(lowerQuery)
        );
      } else {
        products = sampleProducts;
      }

      total = products.length;
      products = products.slice(skip, skip + limit);
      
      // 결과 반환
      const result = {
        products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
      
      // 캐시 저장
      cache.set(cacheKey, result, 5 * 60000);
      
      return result;
  }

  // Prisma Client가 있을 때 정상 처리
  try {
    [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          vendors: {
            include: {
              vendor: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);
  } catch (error: any) {
    console.error("Database query error:", error);
    // 오류 발생 시 빈 결과 반환
    products = [];
    total = 0;
  }

  // priceInKRW가 없는 경우 자동으로 환율 변환
  for (const product of products) {
    for (const vendor of product.vendors) {
      if (vendor.price && vendor.currency && !vendor.priceInKRW) {
        try {
          vendor.priceInKRW = await convertToKRW(vendor.price, vendor.currency);
          // DB에 저장 (비동기, 실패해도 계속 진행)
          db.productVendor
            .update({
              where: { id: vendor.id },
              data: { priceInKRW: vendor.priceInKRW },
            })
            .catch((error: any) => {
              console.error(`Failed to update priceInKRW for ${vendor.id}:`, error);
            });
        } catch (error: any) {
          console.error(`Failed to convert price for ${vendor.id}:`, error);
        }
      }
    }
  }

  // 프리미엄 제품 우선 정렬 (프리미엄 만료되지 않은 벤더의 제품)
  const now = new Date();
  const premiumProducts: typeof products = [];
  const regularProducts: typeof products = [];

  products.forEach((product) => {
    const hasPremiumVendor = product.vendors.some((pv: any) => {
      const vendor = pv.vendor;
      return (
        pv.isPremiumFeatured &&
        vendor?.isPremium &&
        (!vendor.premiumExpiresAt || new Date(vendor.premiumExpiresAt) > now)
      );
    });

    if (hasPremiumVendor) {
      premiumProducts.push(product);
    } else {
      regularProducts.push(product);
    }
  });

  // 프리미엄 제품을 우선순위별로 정렬
  premiumProducts.sort((a: any, b: any) => {
    const aPriority = Math.max(
      ...a.vendors
        .filter((pv: any) => pv.isPremiumFeatured)
        .map((pv: any) => pv.premiumPriority || 0)
    );
    const bPriority = Math.max(
      ...b.vendors
        .filter((pv: any) => pv.isPremiumFeatured)
        .map((pv: any) => pv.premiumPriority || 0)
    );
    return bPriority - aPriority;
  });

  // 벡터 검색 결과가 있으면 유사도 순으로 재정렬
  let sortedProducts = [...premiumProducts, ...regularProducts];
  if (vectorSearchProductIds.length > 0 && query && sortBy === "relevance") {
    const productMap = new Map(products.map((p) => [p.id, p]));
    const vectorProducts = vectorSearchProductIds
      .map((id) => productMap.get(id))
      .filter((p): p is typeof products[0] => !!p);
    
    // 프리미엄 제품을 최상단에 유지하면서 벡터 검색 결과 우선 정렬
    const premiumVector = vectorProducts.filter((p) => premiumProducts.includes(p));
    const regularVector = vectorProducts.filter((p) => !premiumProducts.includes(p));
    const remaining = products.filter(
      (p) => !vectorSearchProductIds.includes(p.id) && !premiumProducts.includes(p)
    );
    
    sortedProducts = [...premiumVector, ...regularVector, ...remaining];
  }

  const result = {
    products: sortedProducts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };

  // 캐시 저장 (5분 TTL로 연장하여 성능 개선)
  cache.set(cacheKey, result, 5 * 60000);

  return result;
}

// 제품 ID로 조회
export async function getProductById(id: string) {
  return await db.product.findUnique({
    where: { id },
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
  });
}

// 여러 제품 ID로 조회
export async function getProductsByIds(ids: string[]) {
  return await db.product.findMany({
    where: { id: { in: ids } },
    include: {
      vendors: {
        include: {
          vendor: true,
        },
      },
    },
  });
}

// 브랜드 목록 조회
export async function getBrands(): Promise<string[]> {
  const brands = await db.product.findMany({
    select: { brand: true },
    distinct: ["brand"],
    where: { brand: { not: null } },
  });
  return brands.map((b: any) => b.brand).filter((b: string | null): b is string => !!b);
}