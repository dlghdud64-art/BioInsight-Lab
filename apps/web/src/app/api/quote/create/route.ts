/**
 * 견적서 생성 API
 *
 * @route POST /api/quote/create
 *
 * 사용자가 장바구니에 담은 시약 리스트를 받아서,
 * DB에 Quote 및 QuoteListItem 레코드로 안전하게 저장
 *
 * CFO 요구사항:
 * - 가격 스냅샷 저장 (제품 가격 변동과 무관하게 견적 시점 가격 유지)
 *
 * CTO 요구사항:
 * - ACID Transaction 사용 (prisma.$transaction)
 * - 실패 시 전체 롤백
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, isPrismaAvailable } from '@/lib/db';

export const runtime = 'nodejs';

// ============================================
// Types
// ============================================

interface QuoteItemInput {
  name: string;
  catalogNumber?: string | null;
  specification?: string | null;
  quantity: number;
  unitPrice?: number | null;
  unit?: string | null;
  notes?: string | null;
}

interface CreateQuoteRequest {
  title: string;
  items: QuoteItemInput[];
  totalAmount?: number;
  message?: string;
  source?: 'ai-analysis' | 'manual' | 'import';
}

interface CreateQuoteResponse {
  success: boolean;
  quoteId?: string;
  message?: string;
  error?: string;
}

// ============================================
// Helper: Validate Request Body
// ============================================

function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: '요청 본문이 올바르지 않습니다.' };
  }

  const { title, items } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: '견적서 제목이 필요합니다.' };
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: '최소 1개 이상의 품목이 필요합니다.' };
  }

  // 각 아이템 검증
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
      return { valid: false, error: `품목 ${i + 1}번의 제품명이 필요합니다.` };
    }
    if (item.quantity !== undefined && (typeof item.quantity !== 'number' || item.quantity < 1)) {
      return { valid: false, error: `품목 ${i + 1}번의 수량이 올바르지 않습니다.` };
    }
  }

  return { valid: true };
}

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<CreateQuoteResponse>> {
  console.log('[Quote Create] Request received');

  try {
    // Step 1: Authentication 확인
    const session = await auth();

    // 비로그인 사용자를 위한 guestKey 생성 (옵션)
    let userId: string | null = session?.user?.id || null;
    let guestKey: string | null = null;

    if (!userId) {
      // 비로그인 사용자: guestKey 사용
      guestKey = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      console.log('[Quote Create] Guest mode, key:', guestKey);
    }

    // Step 2: Request Body 파싱 및 검증
    let body: CreateQuoteRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '요청 본문을 파싱할 수 없습니다.' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { title, items, totalAmount, message, source = 'manual' } = body;

    console.log('[Quote Create] Creating quote:', {
      title,
      itemCount: items.length,
      totalAmount,
      source,
      userId: userId || guestKey,
    });

    // Step 3: Prisma 가용성 확인
    if (!isPrismaAvailable || !db) {
      console.error('[Quote Create] Prisma not available');
      return NextResponse.json(
        { success: false, error: '일시적인 오류로 접수되지 않았습니다. 잠시 후 다시 시도해주세요.' },
        { status: 503 }
      );
    }

    // Step 4: ACID Transaction으로 Quote + QuoteListItem 생성
    // 모두 성공하거나, 실패하면 전부 롤백
    const quote = await db.$transaction(async (tx: any) => {
      // 4-1. Quote 생성
      const createdQuote = await tx.quote.create({
        data: {
          userId: userId,
          guestKey: guestKey,
          title: title.trim(),
          description: message || null,
          status: 'PENDING',
          totalAmount: totalAmount || null,
          currency: 'KRW',
          extractionMethod: source,
        },
      });

      console.log('[Quote Create] Quote created:', createdQuote.id);

      // 4-2. QuoteListItem 생성 (가격 스냅샷 저장)
      // CFO 요구사항: unitPrice는 요청 시점의 단가를 그대로 저장
      const quoteItemsData = items.map((item, index) => ({
        quoteId: createdQuote.id,
        lineNumber: index + 1,
        name: item.name.trim(),
        catalogNumber: item.catalogNumber || null,
        // specification을 notes에 저장 (스키마에 specification 필드 없음)
        notes: item.specification || item.notes || null,
        quantity: item.quantity || 1,
        unit: item.unit || 'ea',
        // 가격 스냅샷 (CFO 요구사항)
        unitPrice: item.unitPrice || null,
        lineTotal: item.unitPrice
          ? (item.unitPrice * (item.quantity || 1))
          : null,
        currency: 'KRW',
      }));

      await tx.quoteListItem.createMany({
        data: quoteItemsData,
      });

      console.log('[Quote Create] QuoteListItems created:', quoteItemsData.length);

      return createdQuote;
    });

    // Step 5: 성공 응답
    console.log('[Quote Create] Success! Quote ID:', quote.id);

    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      message: `견적서가 성공적으로 생성되었습니다. (${items.length}개 품목)`,
    });

  } catch (error) {
    // DB 저장 실패 시 명확한 에러 메시지
    console.error('[Quote Create] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Transaction 실패 시 이미 롤백됨
    return NextResponse.json(
      {
        success: false,
        error: '일시적인 오류로 접수되지 않았습니다. 잠시 후 다시 시도해주세요.',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
