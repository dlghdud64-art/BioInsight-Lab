/**
 * AI 문서 분석 API - PDF 분석 엔드포인트
 *
 * @route POST /api/analyze/pdf
 *
 * Flow:
 * 1. PDF 파일 업로드 (FormData)
 * 2. pdf-parse로 텍스트 추출
 * 3. GPT-4o로 구조화된 데이터 추출
 * 4. JSON 응답 반환
 *
 * Mock Mode: OpenAI API 실패 시 더미 데이터 반환 (개발 지속 가능)
 */

import { NextRequest, NextResponse } from 'next/server';
import { robustParsePDF } from '@/lib/ai/robust-pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 60초

// ============================================
// Types
// ============================================

interface AnalyzedItem {
  name: string;
  catalog_number: string | null;
  specification: string | null;
  quantity: string;
  estimated_price: number;
}

interface AnalysisResult {
  title: string;
  summary: string;
  items: AnalyzedItem[];
}

interface APIResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
  mode?: 'live' | 'mock';
  raw_text?: string;
}

// ============================================
// Mock Data (Fallback)
// ============================================

const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  title: "ELISA 실험 프로토콜 - Human IL-6 분석",
  summary: "1. Human IL-6 ELISA Kit를 사용한 혈청/혈장 내 인터루킨-6 정량 분석 프로토콜입니다.\n2. 96-well plate 형식으로, 민감도 2 pg/mL 수준의 고감도 검출이 가능합니다.\n3. 표준 곡선 설정, 샘플 희석, 세척 단계를 포함한 전체 실험 과정이 기술되어 있습니다.",
  items: [
    {
      name: "Human IL-6 ELISA Kit",
      catalog_number: "BL-IL6-001",
      specification: "96 tests, Sensitivity: 2 pg/mL",
      quantity: "1",
      estimated_price: 450000
    },
    {
      name: "PBS (Phosphate Buffered Saline)",
      catalog_number: "P4417",
      specification: "10X, 1L",
      quantity: "2",
      estimated_price: 35000
    },
    {
      name: "Tween-20",
      catalog_number: "P1379",
      specification: "500mL, Molecular Biology Grade",
      quantity: "1",
      estimated_price: 45000
    },
    {
      name: "96-Well Microplate",
      catalog_number: "CLS3590",
      specification: "Flat bottom, High binding",
      quantity: "5",
      estimated_price: 25000
    },
    {
      name: "Microplate Reader",
      catalog_number: null,
      specification: "450nm filter required",
      quantity: "1",
      estimated_price: 0
    },
    {
      name: "Multi-channel Pipette",
      catalog_number: null,
      specification: "8-channel, 20-200μL",
      quantity: "1",
      estimated_price: 0
    }
  ]
};

// ============================================
// OpenAI Analysis Function
// ============================================

async function analyzeWithOpenAI(text: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompt = `너는 바이오 연구 실험 프로토콜 및 견적서 분석 전문가다.
텍스트에서 '실험 제목', '요약', 그리고 '필요한 시약/장비 리스트'를 추출해라.

반드시 아래 JSON 형식으로만 응답해라:
{
  "title": "문서 제목",
  "summary": "3줄 요약 (한국어, 각 줄은 \\n으로 구분)",
  "items": [
    {
      "name": "제품명 (영어/한국어)",
      "catalog_number": "Cat No. (없으면 null)",
      "specification": "규격/용량",
      "quantity": "수량 (숫자 문자열)",
      "estimated_price": 추정 가격 (숫자, 없으면 0)
    }
  ]
}

중요 규칙:
- 가격은 반드시 순수 숫자로 변환 (예: "₩150,000" → 150000)
- quantity는 문자열로 반환 (예: "1", "2")
- catalog_number가 없으면 null
- 모든 시약, 소모품, 장비를 빠짐없이 추출
- JSON만 반환하고 다른 설명은 붙이지 마`;

  const userPrompt = `다음 문서를 분석해서 JSON 형식으로 응답해줘:\n\n${text.slice(0, 10000)}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' } // JSON Mode
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned empty response');
  }

  // JSON 파싱
  const parsed = JSON.parse(content);

  // 데이터 정규화
  return {
    title: parsed.title || '문서 분석 결과',
    summary: parsed.summary || '요약을 생성할 수 없습니다.',
    items: (parsed.items || []).map((item: any) => ({
      name: item.name || '',
      catalog_number: item.catalog_number || null,
      specification: item.specification || item.spec || null,
      quantity: String(item.quantity || '1'),
      estimated_price: typeof item.estimated_price === 'number'
        ? item.estimated_price
        : parseInt(String(item.estimated_price || '0').replace(/[^0-9]/g, ''), 10) || 0
    }))
  };
}

// ============================================
// Main API Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse<APIResponse>> {
  console.log('[Analyze PDF] Request received');

  try {
    // Step 1: Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 업로드되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'PDF 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // File size limit: 20MB
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 20MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    console.log('[Analyze PDF] File received:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type
    });

    // Step 2: Extract text from PDF
    console.log('[Analyze PDF] Step 2: Extracting text...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfResult = await robustParsePDF(buffer);

    if (!pdfResult.success || !pdfResult.text) {
      console.error('[Analyze PDF] Text extraction failed:', pdfResult.error);

      // PDF 추출 실패 시에도 Mock 반환
      return NextResponse.json({
        success: true,
        data: {
          ...MOCK_ANALYSIS_RESULT,
          title: file.name.replace('.pdf', '') || MOCK_ANALYSIS_RESULT.title
        },
        mode: 'mock',
        error: pdfResult.error
      });
    }

    console.log('[Analyze PDF] Text extracted:', {
      length: pdfResult.text.length,
      method: pdfResult.extractionMethod,
      pages: pdfResult.metadata?.pages
    });

    // Step 3: AI Analysis with OpenAI
    console.log('[Analyze PDF] Step 3: AI Analysis...');

    try {
      const analysisResult = await analyzeWithOpenAI(pdfResult.text);

      console.log('[Analyze PDF] Analysis complete:', {
        title: analysisResult.title,
        itemCount: analysisResult.items.length
      });

      // Step 4: Return success response
      return NextResponse.json({
        success: true,
        data: analysisResult,
        mode: 'live',
        raw_text: pdfResult.text.slice(0, 2000) // 디버깅용
      });

    } catch (aiError) {
      // AI 분석 실패 시 Mock Data 반환
      console.error('[Analyze PDF] AI analysis failed, returning mock data:', aiError);

      return NextResponse.json({
        success: true,
        data: {
          ...MOCK_ANALYSIS_RESULT,
          title: file.name.replace('.pdf', '') || MOCK_ANALYSIS_RESULT.title
        },
        mode: 'mock',
        error: aiError instanceof Error ? aiError.message : 'AI 분석 실패',
        raw_text: pdfResult.text.slice(0, 2000)
      });
    }

  } catch (error) {
    console.error('[Analyze PDF] Fatal error:', error);

    // 치명적 오류에서도 Mock Data 반환 (프론트 개발 중단 방지)
    return NextResponse.json({
      success: true,
      data: MOCK_ANALYSIS_RESULT,
      mode: 'mock',
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
}
