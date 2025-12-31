/**
 * GPT-4 기반 견적서 정밀 분석
 * - 깨진 텍스트도 찰떡같이 이해
 * - 가격, 캣넘버, 납기일 자동 추출
 * - 순수 숫자로 변환 (기호 제거)
 */

interface QuoteItem {
  name: string;
  catalogNumber: string | null;
  price: number | null;
  leadTime: string | null;
  quantity: number | null;
  unit: string | null;
}

interface QuoteParseResult {
  vendor: string;
  items: QuoteItem[];
  totalAmount: number | null;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  rawText?: string; // 디버깅용
}

/**
 * OpenAI GPT-4로 견적서 분석
 */
export async function parseQuoteWithAI(
  extractedText: string
): Promise<QuoteParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = `너는 바이오 연구용품 견적서 전문 AI야.
아래 텍스트는 PDF에서 추출한 견적서 내용인데, 레이아웃이 깨져 있을 수 있어.
하지만 너는 찰떡같이 알아듣고, 아래 정보를 JSON으로 정확하게 추출해야 해:

**추출할 정보:**
1. **vendor** (공급사 이름): 회사명을 찾아. 없으면 "Unknown"
2. **items** (제품 리스트): 배열로 반환
   - name: 제품명
   - catalogNumber: 카탈로그 번호 (Cat#, Part#, Model# 등)
   - price: 가격 (숫자만, ₩ , 원 같은 기호 제거)
   - leadTime: 납기일 (예: "3-5일", "1주", 있으면)
   - quantity: 수량 (숫자만)
   - unit: 단위 (EA, BOX, SET 등)
3. **totalAmount**: 총 금액 (숫자만)
4. **currency**: 통화 ("KRW", "USD" 등)
5. **confidence**: 추출 신뢰도 ("high", "medium", "low")

**중요 규칙:**
- 가격은 반드시 순수 숫자(Integer)로 변환해. 예: "₩150,000원" → 150000
- catalogNumber가 없으면 null
- leadTime이 없으면 null
- 여러 제품이 있으면 모두 추출
- JSON만 반환하고 다른 설명 붙이지 마

**입력 텍스트:**
${extractedText}

**응답 형식:**
\`\`\`json
{
  "vendor": "공급사명",
  "items": [
    {
      "name": "제품명",
      "catalogNumber": "CAT-123",
      "price": 150000,
      "leadTime": "3-5일",
      "quantity": 1,
      "unit": "EA"
    }
  ],
  "totalAmount": 150000,
  "currency": "KRW",
  "confidence": "high"
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
            content:
              '너는 바이오 연구용품 견적서 분석 전문 AI다. 깨진 텍스트에서도 정확한 정보를 추출한다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // 낮은 온도로 일관성 확보
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API 오류: ${response.status} - ${JSON.stringify(errorData)}`
      );
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

    const parsed: QuoteParseResult = JSON.parse(jsonText);

    // 가격 숫자 변환 재확인 (혹시 문자열이면 변환)
    if (parsed.items) {
      parsed.items = parsed.items.map((item) => ({
        ...item,
        price:
          typeof item.price === 'string'
            ? parseInt(item.price.replace(/[^0-9]/g, ''), 10) || null
            : item.price,
        quantity:
          typeof item.quantity === 'string'
            ? parseInt(item.quantity.replace(/[^0-9]/g, ''), 10) || null
            : item.quantity,
      }));
    }

    if (typeof parsed.totalAmount === 'string') {
      parsed.totalAmount =
        parseInt(parsed.totalAmount.replace(/[^0-9]/g, ''), 10) || null;
    }

    console.log('[AI Parser] Success:', {
      vendor: parsed.vendor,
      itemCount: parsed.items?.length || 0,
      confidence: parsed.confidence,
    });

    return {
      ...parsed,
      rawText: extractedText.slice(0, 500), // 디버깅용 (처음 500자만)
    };
  } catch (error) {
    console.error('[AI Parser] Error:', error);
    throw new Error(
      `AI 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}
