// 성능 최적화된 제품 조회 함수들
// 배치 로딩 및 쿼리 최적화

import { db } from "@/lib/db";
import { cache, createCacheKey } from "@/lib/cache";
import { convertToKRW } from "@/lib/api/exchange-rate";

/**
 * 제품 ID 목록으로 벤더 정보를 배치로 조회 (N+1 문제 해결)
 */
export async function getVendorsByProductIds(productIds: string[]) {
  if (productIds.length === 0) return [];

  const cacheKey = `vendors:products:${productIds.sort().join(",")}`;
  const cached = cache.get<Array<{ productId: string; vendors: any[] }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const vendors = await db.productVendor.findMany({
    where: {
      productId: { in: productIds },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
    },
    orderBy: {
      priceInKRW: "asc",
    },
  });

  // 제품별로 그룹화
  const vendorsByProduct = productIds.map((productId) => ({
    productId,
    vendors: vendors.filter((v) => v.productId === productId),
  }));

  // 캐시 저장 (5분 TTL)
  cache.set(cacheKey, vendorsByProduct, 5 * 60000);

  return vendorsByProduct;
}

/**
 * 제품 목록에 대한 환율 변환을 배치로 처리
 */
export async function batchConvertPricesToKRW(
  vendors: Array<{ price?: number; currency: string; id: string }>
) {
  const needsConversion = vendors.filter(
    (v) => v.price && v.currency !== "KRW" && !v.priceInKRW
  );

  if (needsConversion.length === 0) {
    return;
  }

  // 환율 변환을 병렬로 처리
  const conversions = await Promise.allSettled(
    needsConversion.map(async (vendor) => {
      const priceInKRW = await convertToKRW(vendor.price!, vendor.currency);
      return { vendorId: vendor.id, priceInKRW };
    })
  );

  // 성공한 변환만 DB에 업데이트 (배치 업데이트)
  const updates = conversions
    .filter((r): r is PromiseFulfilledResult<{ vendorId: string; priceInKRW: number }> => 
      r.status === "fulfilled"
    )
    .map((r) => r.value);

  if (updates.length > 0) {
    // Prisma는 배치 업데이트를 지원하지 않으므로 Promise.all 사용
    await Promise.all(
      updates.map(({ vendorId, priceInKRW }) =>
        db.productVendor.update({
          where: { id: vendorId },
          data: { priceInKRW },
        })
      )
    );
  }
}



// 배치 로딩 및 쿼리 최적화

import { db } from "@/lib/db";
import { cache, createCacheKey } from "@/lib/cache";
import { convertToKRW } from "@/lib/api/exchange-rate";

/**
 * 제품 ID 목록으로 벤더 정보를 배치로 조회 (N+1 문제 해결)
 */
export async function getVendorsByProductIds(productIds: string[]) {
  if (productIds.length === 0) return [];

  const cacheKey = `vendors:products:${productIds.sort().join(",")}`;
  const cached = cache.get<Array<{ productId: string; vendors: any[] }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const vendors = await db.productVendor.findMany({
    where: {
      productId: { in: productIds },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
    },
    orderBy: {
      priceInKRW: "asc",
    },
  });

  // 제품별로 그룹화
  const vendorsByProduct = productIds.map((productId) => ({
    productId,
    vendors: vendors.filter((v) => v.productId === productId),
  }));

  // 캐시 저장 (5분 TTL)
  cache.set(cacheKey, vendorsByProduct, 5 * 60000);

  return vendorsByProduct;
}

/**
 * 제품 목록에 대한 환율 변환을 배치로 처리
 */
export async function batchConvertPricesToKRW(
  vendors: Array<{ price?: number; currency: string; id: string }>
) {
  const needsConversion = vendors.filter(
    (v) => v.price && v.currency !== "KRW" && !v.priceInKRW
  );

  if (needsConversion.length === 0) {
    return;
  }

  // 환율 변환을 병렬로 처리
  const conversions = await Promise.allSettled(
    needsConversion.map(async (vendor) => {
      const priceInKRW = await convertToKRW(vendor.price!, vendor.currency);
      return { vendorId: vendor.id, priceInKRW };
    })
  );

  // 성공한 변환만 DB에 업데이트 (배치 업데이트)
  const updates = conversions
    .filter((r): r is PromiseFulfilledResult<{ vendorId: string; priceInKRW: number }> => 
      r.status === "fulfilled"
    )
    .map((r) => r.value);

  if (updates.length > 0) {
    // Prisma는 배치 업데이트를 지원하지 않으므로 Promise.all 사용
    await Promise.all(
      updates.map(({ vendorId, priceInKRW }) =>
        db.productVendor.update({
          where: { id: vendorId },
          data: { priceInKRW },
        })
      )
    );
  }
}



// 배치 로딩 및 쿼리 최적화

import { db } from "@/lib/db";
import { cache, createCacheKey } from "@/lib/cache";
import { convertToKRW } from "@/lib/api/exchange-rate";

/**
 * 제품 ID 목록으로 벤더 정보를 배치로 조회 (N+1 문제 해결)
 */
export async function getVendorsByProductIds(productIds: string[]) {
  if (productIds.length === 0) return [];

  const cacheKey = `vendors:products:${productIds.sort().join(",")}`;
  const cached = cache.get<Array<{ productId: string; vendors: any[] }>>(cacheKey);
  if (cached) {
    return cached;
  }

  const vendors = await db.productVendor.findMany({
    where: {
      productId: { in: productIds },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          country: true,
        },
      },
    },
    orderBy: {
      priceInKRW: "asc",
    },
  });

  // 제품별로 그룹화
  const vendorsByProduct = productIds.map((productId) => ({
    productId,
    vendors: vendors.filter((v) => v.productId === productId),
  }));

  // 캐시 저장 (5분 TTL)
  cache.set(cacheKey, vendorsByProduct, 5 * 60000);

  return vendorsByProduct;
}

/**
 * 제품 목록에 대한 환율 변환을 배치로 처리
 */
export async function batchConvertPricesToKRW(
  vendors: Array<{ price?: number; currency: string; id: string }>
) {
  const needsConversion = vendors.filter(
    (v) => v.price && v.currency !== "KRW" && !v.priceInKRW
  );

  if (needsConversion.length === 0) {
    return;
  }

  // 환율 변환을 병렬로 처리
  const conversions = await Promise.allSettled(
    needsConversion.map(async (vendor) => {
      const priceInKRW = await convertToKRW(vendor.price!, vendor.currency);
      return { vendorId: vendor.id, priceInKRW };
    })
  );

  // 성공한 변환만 DB에 업데이트 (배치 업데이트)
  const updates = conversions
    .filter((r): r is PromiseFulfilledResult<{ vendorId: string; priceInKRW: number }> => 
      r.status === "fulfilled"
    )
    .map((r) => r.value);

  if (updates.length > 0) {
    // Prisma는 배치 업데이트를 지원하지 않으므로 Promise.all 사용
    await Promise.all(
      updates.map(({ vendorId, priceInKRW }) =>
        db.productVendor.update({
          where: { id: vendorId },
          data: { priceInKRW },
        })
      )
    );
  }
}





