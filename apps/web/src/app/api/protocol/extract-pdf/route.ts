/**
 * 프로덕션 레벨 PDF 견적서 자동 처리 API
 *
 * PDF 업로드 → AI 분석 → DB 저장
 *
 * Flow:
 * 1. PDF 업로드 (Robust Parser)
 * 2. 텍스트 추출 (Fallback 지원)
 * 3. GPT-4 정밀 분석 (가격/캣넘버/납기 추출)
 * 4. Prisma DB 자동 저장 (status: PARSED)
 * 5. 사용자는 "확인" 버튼만 누르면 끝
 *
 * 구조화 진단 로깅: requestId 기반 전체 파이프라인 추적
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { enforceAction, InlineEnforcementHandle } from '@/lib/security/server-enforcement-middleware';
import { db } from '@/lib/db';
import { robustParsePDF } from '@/lib/ai/robust-pdf-parser';
import { parseQuoteWithAI } from '@/lib/ai/quote-ai-parser';
import {
  logPipelineStage,
  createRequestId,
  type PipelineErrorCode,
} from '@/lib/ai/pipeline-logger';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60초

interface ExtractPDFResponse {
  success: boolean;
  quoteId?: string;
  vendor?: string;
  itemCount?: number;
  totalAmount?: number;
  error?: string;
  errorCode?: string;
  extractionMethod?: string;
  confidence?: string;
  requestId?: string;
}

/**
 * POST /api/protocol/extract-pdf
 * PDF 견적서 업로드 → AI 분석 → DB 저장
 */
export async function POST(request: NextRequest): Promise<NextResponse<ExtractPDFResponse>> {
  const requestId = createRequestId();
  const pipelineStart = Date.now();
  let session;
  let enforcement: InlineEnforcementHandle | undefined;

  try {
    // 1. 인증 확인 (게스트도 허용 가능하도록 선택적)
    session = await auth();
    const userId = session?.user?.id || 'guest';

    if (session?.user?.id) {
      enforcement = enforceAction({
        userId: session.user.id,
        userRole: session.user.role ?? undefined,
        action: 'sensitive_data_import',
        targetEntityType: 'quote',
        targetEntityId: 'unknown',
        sourceSurface: 'web_app',
        routePath: '/protocol/extract-pdf',
      });
      if (!enforcement.allowed) return enforcement.deny() as NextResponse<ExtractPDFResponse>;
    }

    // 2. FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      logPipelineStage({
        stage: "final_failure",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "UPLOAD_FAILED",
        errorMessage: "No file provided",
        durationMs: Date.now() - pipelineStart,
      });
      return NextResponse.json(
        { success: false, error: '파일이 없습니다.', requestId },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      logPipelineStage({
        stage: "final_failure",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "UNSUPPORTED_FORMAT",
        errorMessage: `Unsupported MIME: ${file.type}`,
        fileName: file.name,
        fileSize: file.size,
        durationMs: Date.now() - pipelineStart,
      });
      return NextResponse.json(
        { success: false, error: 'PDF 파일만 업로드 가능합니다.', errorCode: 'UNSUPPORTED_FORMAT', requestId },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 20MB 이하여야 합니다.', requestId },
        { status: 400 }
      );
    }

    logPipelineStage({
      stage: "upload_received",
      requestId,
      timestamp: new Date().toISOString(),
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    // 3. PDF → Buffer 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Robust PDF Parser (Fail-safe)
    logPipelineStage({
      stage: "pdf_parse_started",
      requestId,
      timestamp: new Date().toISOString(),
      fileName: file.name,
    });

    const pdfParseStart = Date.now();
    const pdfResult = await robustParsePDF(buffer, file.size);

    if (!pdfResult.success || !pdfResult.text) {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: (pdfResult.errorCode as PipelineErrorCode) ?? "PDF_NO_TEXT",
        errorMessage: pdfResult.error,
        durationMs: Date.now() - pdfParseStart,
        fileName: file.name,
      });
      return NextResponse.json(
        {
          success: false,
          error: pdfResult.error || 'PDF 텍스트 추출 실패',
          errorCode: pdfResult.errorCode,
          extractionMethod: pdfResult.extractionMethod,
          requestId,
        },
        { status: 400 }
      );
    }

    logPipelineStage({
      stage: "pdf_parse_completed",
      requestId,
      timestamp: new Date().toISOString(),
      extractionMethod: pdfResult.extractionMethod,
      extractedTextLength: pdfResult.text.length,
      pageCount: pdfResult.metadata?.pages,
      hasTextLayer: pdfResult.metadata?.hasTextLayer,
      durationMs: Date.now() - pdfParseStart,
    });

    // 5. GPT-4 AI 분석 (정밀 파싱)
    logPipelineStage({
      stage: "llm_request_started",
      requestId,
      timestamp: new Date().toISOString(),
      model: "gpt-4o",
      textLength: pdfResult.text.length,
    });

    const llmStart = Date.now();
    const aiResult = await parseQuoteWithAI(pdfResult.text, requestId);

    logPipelineStage({
      stage: "llm_response_received",
      requestId,
      timestamp: new Date().toISOString(),
      vendor: aiResult.vendor,
      itemCount: aiResult.items.length,
      confidence: aiResult.confidence,
      durationMs: Date.now() - llmStart,
    });

    // 6. DB 저장 (Prisma Transaction)
    logPipelineStage({
      stage: "db_save_started",
      requestId,
      timestamp: new Date().toISOString(),
    });

    const dbStart = Date.now();

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

    logPipelineStage({
      stage: "db_save_completed",
      requestId,
      timestamp: new Date().toISOString(),
      quoteId: quote.id,
      durationMs: Date.now() - dbStart,
    });

    logPipelineStage({
      stage: "final_success",
      requestId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - pipelineStart,
      vendor: aiResult.vendor,
      itemCount: aiResult.items.length,
      quoteId: quote.id,
    });

    enforcement?.complete({});

    // 7. 성공 응답
    return NextResponse.json({
      success: true,
      quoteId: quote.id,
      vendor: aiResult.vendor,
      itemCount: aiResult.items.length,
      totalAmount: aiResult.totalAmount || undefined,
      extractionMethod: pdfResult.extractionMethod,
      confidence: aiResult.confidence,
      requestId,
    });
  } catch (error) {
    enforcement?.fail();

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'PDF 처리 중 알 수 없는 오류가 발생했습니다.';

    logPipelineStage({
      stage: "final_failure",
      requestId,
      timestamp: new Date().toISOString(),
      errorCode: "UNKNOWN",
      errorMessage,
      durationMs: Date.now() - pipelineStart,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}
