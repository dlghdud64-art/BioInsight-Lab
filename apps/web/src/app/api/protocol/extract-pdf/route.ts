/**
 * 프로덕션 레벨 PDF 견적서 자동 처리 API
 *
 * 📄 PDF 업로드 → 🤖 AI 분석 → 💾 DB 저장
 *
 * Flow:
 * 1. PDF 업로드 (Robust Parser)
 * 2. 텍스트 추출 (Fallback 지원)
 * 3. GPT-4 정밀 분석 (가격/캣넘버/납기 추출)
 * 4. Prisma DB 자동 저장 (status: PARSED)
 * 5. 사용자는 "확인" 버튼만 누르면 끝
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { robustParsePDF } from '@/lib/ai/robust-pdf-parser';
import { parseQuoteWithAI } from '@/lib/ai/quote-ai-parser';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60초

interface ExtractPDFResponse {
  success: boolean;
  quoteId?: string;
  vendor?: string;
  itemCount?: number;
  totalAmount?: number;
  error?: string;
  extractionMethod?: string;
  confidence?: string;
}

/**
 * POST /api/protocol/extract-pdf
 * PDF 견적서 업로드 → AI 분석 → DB 저장
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractPDFResponse>> {
  let session;

  try {
    // 1. 인증 확인 (게스트도 허용 가능하도록 선택적)
    session = await auth();
    const userId = session?.user?.id || 'guest';

    // 2. FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'PDF 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 20MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    console.log('[Extract PDF] Processing file:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      userId,
    });

    // 3. PDF → Buffer 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Robust PDF Parser (Fail-safe)
    console.log('[Extract PDF] Step 1: Text extraction...');
    const pdfResult = await robustParsePDF(buffer);

    if (!pdfResult.success || !pdfResult.text) {
      console.error('[Extract PDF] Text extraction failed:', pdfResult.error);
      return NextResponse.json(
        {
          success: false,
          error: pdfResult.error || 'PDF 텍스트 추출 실패',
          extractionMethod: pdfResult.extractionMethod,
        },
        { status: 400 }
      );
    }

    console.log('[Extract PDF] Text extracted:', {
      method: pdfResult.extractionMethod,
      length: pdfResult.text.length,
      pages: pdfResult.metadata?.pages,
    });

    // 5. GPT-4 AI 분석 (정밀 파싱)
    console.log('[Extract PDF] Step 2: AI analysis...');
    const aiResult = await parseQuoteWithAI(pdfResult.text);

    console.log('[Extract PDF] AI analysis complete:', {
      vendor: aiResult.vendor,
      itemCount: aiResult.items.length,
      confidence: aiResult.confidence,
      totalAmount: aiResult.totalAmount,
    });

    // 6. DB 저장 (Prisma Transaction)
    console.log('[Extract PDF] Step 3: Saving to database...');

    // 사용자의 조직 찾기
    let organizationId: string | null = null;
    if (session?.user?.id) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      organizationId = membership?.organizationId || null;
    }

    const quote = await db.quote.create({
      data: {
        userId: session?.user?.id || 'guest',
        organizationId,
        status: 'PARSED', // 자동 파싱 완료 상태
        title: `${aiResult.vendor} 견적서 - ${file.name}`,
        vendor: aiResult.vendor,
        totalAmount: aiResult.totalAmount || 0,
        currency: aiResult.currency || 'KRW',
        confidence: aiResult.confidence,
        extractionMethod: pdfResult.extractionMethod,
        pdfFileName: file.name,
        rawText: pdfResult.text.slice(0, 10000), // 원본 텍스트 (최대 10KB)

        // Quote Items 생성 (QuoteListItem 사용)
        items: {
          create: aiResult.items.map((item: any, index: number) => ({
            name: item.name,
            catalogNumber: item.catalogNumber,
            unitPrice: item.price,
            quantity: item.quantity || 1,
            unit: item.unit || 'EA',
            leadTime: item.leadTime,
            position: index,
            lineTotal: item.price ? (item.price * (item.quantity || 1)) : null,
            currency: aiResult.currency,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    if (process.env.NODE_ENV === "development") {
      console.log('[Extract PDF] ✅ Success! Quote created:', quote.id);
    }

    // 7. 성공 응답
    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      vendor: aiResult.vendor,
      itemCount: aiResult.items.length,
      totalAmount: aiResult.totalAmount || undefined,
      extractionMethod: pdfResult.extractionMethod,
      confidence: aiResult.confidence,
    });
  } catch (error) {
    console.error('[Extract PDF] ❌ Fatal error:', error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'PDF 처리 중 알 수 없는 오류가 발생했습니다.';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
