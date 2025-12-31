/**
 * AI 문서 분석 API
 *
 * PDF 업로드 → 텍스트 추출 → GPT-4 분석 → 구조화된 JSON 반환
 *
 * Response:
 * {
 *   success: boolean,
 *   analysis_title: string,
 *   summary: string,
 *   extracted_items: [{ item_name, catalog_number, spec, quantity, estimated_price }],
 *   raw_text?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { robustParsePDF } from '@/lib/ai/robust-pdf-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ExtractedItem {
  item_name: string;
  catalog_number: string | null;
  spec: string | null;
  quantity: string | null;
  estimated_price: number | null;
  unit?: string | null;
}

interface AnalysisResponse {
  success: boolean;
  analysis_title: string;
  summary: string;
  extracted_items: ExtractedItem[];
  raw_text?: string;
  error?: string;
  extraction_method?: string;
}

/**
 * GPT-4로 문서 분석
 */
async function analyzeWithAI(text: string, fileName: string): Promise<{
  title: string;
  summary: string;
  items: ExtractedItem[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = `너는 바이오 연구용품 문서 분석 전문 AI야.
아래 텍스트는 PDF에서 추출한 내용인데, 레이아웃이 깨져 있을 수 있어.
하지만 너는 찰떡같이 알아듣고, 아래 정보를 JSON으로 정확하게 추출해야 해:

**추출할 정보:**
1. **title**: 문서 제목 (없으면 파일명 "${fileName}" 사용)
2. **summary**: 문서 내용 3줄 요약 (한국어)
3. **items**: 시약/소모품/장비 리스트 (배열)
   - item_name: 제품명 (필수)
   - catalog_number: 카탈로그 번호 (Cat#, Part#, Model#, SKU 등)
   - spec: 규격/사양 (용량, 농도, 순도 등 - 문자열로)
   - quantity: 수량 (문자열로, "1 EA", "2 BOX" 등)
   - estimated_price: 예상 가격 (숫자만, 없으면 null)
   - unit: 단위 (EA, BOX, SET 등)

**중요 규칙:**
- 가격은 반드시 순수 숫자(Integer)로 변환해. 예: "₩150,000원" → 150000
- catalog_number가 없으면 null
- 모든 시약/소모품/장비를 추출해 (실험 프로토콜에서 언급된 것도 포함)
- JSON만 반환하고 다른 설명 붙이지 마

**입력 텍스트:**
${text.slice(0, 8000)}

**응답 형식:**
\`\`\`json
{
  "title": "문서 제목",
  "summary": "1. 첫번째 요약\\n2. 두번째 요약\\n3. 세번째 요약",
  "items": [
    {
      "item_name": "제품명",
      "catalog_number": "CAT-123",
      "spec": "500mL, 99% purity",
      "quantity": "1 EA",
      "estimated_price": 150000,
      "unit": "EA"
    }
  ]
}
\`\`\``;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '너는 바이오 연구용품 문서 분석 전문 AI다. 깨진 텍스트에서도 정확한 정보를 추출한다. 한국어로 응답한다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API 오류: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI 응답이 비어 있습니다.');
    }

    // JSON 추출 (코드 블록 제거)
    let jsonText = content.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    // 가격 정규화
    const normalizedItems: ExtractedItem[] = (parsed.items || []).map((item: any) => ({
      item_name: item.item_name || item.name || '',
      catalog_number: item.catalog_number || item.catalogNumber || null,
      spec: item.spec || item.specification || null,
      quantity: item.quantity || '1',
      estimated_price: typeof item.estimated_price === 'string'
        ? parseInt(item.estimated_price.replace(/[^0-9]/g, ''), 10) || null
        : (item.estimated_price || item.price || null),
      unit: item.unit || null,
    }));

    return {
      title: parsed.title || fileName,
      summary: parsed.summary || '문서 요약을 생성할 수 없습니다.',
      items: normalizedItems,
    };
  } catch (error) {
    console.error('[AI Analyze] Error:', error);
    throw error;
  }
}

/**
 * POST /api/protocol/analyze
 * PDF 업로드 → AI 분석 → 구조화된 결과 반환
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
    // 1. FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          analysis_title: '',
          summary: '',
          extracted_items: [],
          error: '파일이 없습니다.',
        },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        {
          success: false,
          analysis_title: '',
          summary: '',
          extracted_items: [],
          error: 'PDF 파일만 업로드 가능합니다.',
        },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          analysis_title: '',
          summary: '',
          extracted_items: [],
          error: '파일 크기는 20MB 이하여야 합니다.',
        },
        { status: 400 }
      );
    }

    console.log('[Analyze PDF] Processing file:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });

    // 2. PDF → Buffer 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. PDF 텍스트 추출
    console.log('[Analyze PDF] Step 1: Text extraction...');
    const pdfResult = await robustParsePDF(buffer);

    if (!pdfResult.success || !pdfResult.text) {
      console.error('[Analyze PDF] Text extraction failed:', pdfResult.error);

      // 실패해도 빈 리스트 반환 (에러 던지지 않음)
      return NextResponse.json({
        success: false,
        analysis_title: file.name,
        summary: '분석 실패: PDF 텍스트를 추출할 수 없습니다. 직접 입력해주세요.',
        extracted_items: [],
        error: pdfResult.error,
        extraction_method: pdfResult.extractionMethod,
      });
    }

    console.log('[Analyze PDF] Text extracted:', {
      method: pdfResult.extractionMethod,
      length: pdfResult.text.length,
      pages: pdfResult.metadata?.pages,
    });

    // 4. GPT-4 AI 분석
    console.log('[Analyze PDF] Step 2: AI analysis...');

    try {
      const aiResult = await analyzeWithAI(pdfResult.text, file.name);

      console.log('[Analyze PDF] AI analysis complete:', {
        title: aiResult.title,
        itemCount: aiResult.items.length,
      });

      // 5. 성공 응답
      return NextResponse.json({
        success: true,
        analysis_title: aiResult.title,
        summary: aiResult.summary,
        extracted_items: aiResult.items,
        raw_text: pdfResult.text.slice(0, 2000), // 원본 텍스트 일부 (디버깅용)
        extraction_method: pdfResult.extractionMethod,
      });
    } catch (aiError) {
      console.error('[Analyze PDF] AI analysis failed:', aiError);

      // AI 분석 실패해도 빈 리스트 반환
      return NextResponse.json({
        success: false,
        analysis_title: file.name,
        summary: '분석 실패: AI 분석 중 오류가 발생했습니다. 직접 입력해주세요.',
        extracted_items: [],
        raw_text: pdfResult.text.slice(0, 2000),
        error: aiError instanceof Error ? aiError.message : 'AI 분석 실패',
        extraction_method: pdfResult.extractionMethod,
      });
    }
  } catch (error) {
    console.error('[Analyze PDF] Fatal error:', error);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    return NextResponse.json({
      success: false,
      analysis_title: '',
      summary: '분석 실패: 직접 입력해주세요.',
      extracted_items: [],
      error: errorMessage,
    });
  }
}
