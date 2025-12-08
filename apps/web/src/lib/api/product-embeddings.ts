import { db } from "@/lib/db";
import { getEmbedding } from "@/lib/ai/embeddings";

// 제품 임베딩 생성 및 저장
export async function generateAndStoreProductEmbedding(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      nameEn: true,
      description: true,
      descriptionEn: true,
      specifications: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // 제품 정보를 텍스트로 결합
  const textParts = [
    product.name,
    product.nameEn,
    product.description,
    product.descriptionEn,
  ];

  // 스펙 정보도 텍스트로 변환
  if (product.specifications) {
    const specs = product.specifications as Record<string, any>;
    textParts.push(...Object.entries(specs).map(([key, value]) => `${key}: ${value}`));
  }

  const text = textParts.filter(Boolean).join(" ");

  if (!text) {
    throw new Error("Product has no text content to embed");
  }

  // 임베딩 생성
  const embedding = await getEmbedding(text);

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // pgvector에 저장
  try {
    const embeddingArray = `[${embedding.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
      embeddingArray,
      productId
    );

    return { success: true };
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      throw new Error("pgvector extension is not enabled in PostgreSQL");
    }
    throw error;
  }
}

// 벡터 유사도 검색
export async function searchProductsByVector(
  queryEmbedding: number[],
  limit: number = 20,
  threshold: number = 0.7
) {
  try {
    const embeddingArray = `[${queryEmbedding.join(",")}]`;
    
    const results = await db.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT 
        id,
        1 - (embedding <=> $1::vector) as similarity
      FROM "Product"
      WHERE embedding IS NOT NULL
        AND (1 - (embedding <=> $1::vector)) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      embeddingArray,
      threshold,
      limit
    );

    return results;
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      console.warn("pgvector is not enabled, vector search skipped");
      return [];
    }
    throw error;
  }
}



// 제품 임베딩 생성 및 저장
export async function generateAndStoreProductEmbedding(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      nameEn: true,
      description: true,
      descriptionEn: true,
      specifications: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // 제품 정보를 텍스트로 결합
  const textParts = [
    product.name,
    product.nameEn,
    product.description,
    product.descriptionEn,
  ];

  // 스펙 정보도 텍스트로 변환
  if (product.specifications) {
    const specs = product.specifications as Record<string, any>;
    textParts.push(...Object.entries(specs).map(([key, value]) => `${key}: ${value}`));
  }

  const text = textParts.filter(Boolean).join(" ");

  if (!text) {
    throw new Error("Product has no text content to embed");
  }

  // 임베딩 생성
  const embedding = await getEmbedding(text);

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // pgvector에 저장
  try {
    const embeddingArray = `[${embedding.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
      embeddingArray,
      productId
    );

    return { success: true };
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      throw new Error("pgvector extension is not enabled in PostgreSQL");
    }
    throw error;
  }
}

// 벡터 유사도 검색
export async function searchProductsByVector(
  queryEmbedding: number[],
  limit: number = 20,
  threshold: number = 0.7
) {
  try {
    const embeddingArray = `[${queryEmbedding.join(",")}]`;
    
    const results = await db.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT 
        id,
        1 - (embedding <=> $1::vector) as similarity
      FROM "Product"
      WHERE embedding IS NOT NULL
        AND (1 - (embedding <=> $1::vector)) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      embeddingArray,
      threshold,
      limit
    );

    return results;
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      console.warn("pgvector is not enabled, vector search skipped");
      return [];
    }
    throw error;
  }
}



// 제품 임베딩 생성 및 저장
export async function generateAndStoreProductEmbedding(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      nameEn: true,
      description: true,
      descriptionEn: true,
      specifications: true,
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // 제품 정보를 텍스트로 결합
  const textParts = [
    product.name,
    product.nameEn,
    product.description,
    product.descriptionEn,
  ];

  // 스펙 정보도 텍스트로 변환
  if (product.specifications) {
    const specs = product.specifications as Record<string, any>;
    textParts.push(...Object.entries(specs).map(([key, value]) => `${key}: ${value}`));
  }

  const text = textParts.filter(Boolean).join(" ");

  if (!text) {
    throw new Error("Product has no text content to embed");
  }

  // 임베딩 생성
  const embedding = await getEmbedding(text);

  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // pgvector에 저장
  try {
    const embeddingArray = `[${embedding.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
      embeddingArray,
      productId
    );

    return { success: true };
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      throw new Error("pgvector extension is not enabled in PostgreSQL");
    }
    throw error;
  }
}

// 벡터 유사도 검색
export async function searchProductsByVector(
  queryEmbedding: number[],
  limit: number = 20,
  threshold: number = 0.7
) {
  try {
    const embeddingArray = `[${queryEmbedding.join(",")}]`;
    
    const results = await db.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT 
        id,
        1 - (embedding <=> $1::vector) as similarity
      FROM "Product"
      WHERE embedding IS NOT NULL
        AND (1 - (embedding <=> $1::vector)) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      embeddingArray,
      threshold,
      limit
    );

    return results;
  } catch (error: any) {
    if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
      console.warn("pgvector is not enabled, vector search skipped");
      return [];
    }
    throw error;
  }
}

