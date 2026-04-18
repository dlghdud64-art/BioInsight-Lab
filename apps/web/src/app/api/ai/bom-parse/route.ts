/**
 * POST /api/ai/bom-parse
 *
 * 비정형 BOM 텍스트를 Gemini AI로 파싱하여
 * 품목명, 수량, 카테고리, 예상 단가를 구조화합니다.
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";

const BOM_PARSE_SYSTEM_PROMPT = `당신은 연구실 BOM(Bill of Materials) 파싱 전문가입니다.
사용자가 비정형 텍스트(복사/붙여넣기)로 시약·소모품 목록을 제공하면, 각 품목을 정확히 분리하여 구조화된 JSON으로 반환합니다.

[파싱 지시사항]
1. 텍스트에서 품목명, 수량, 단위, 카테고리(REAGENT/CONSUMABLE/EQUIPMENT), 추정 용도를 추출하세요.
2. 수량이 명시되지 않은 경우 기본 1로 설정하세요.
3. 카탈로그 번호가 보이면 함께 추출하세요.
4. 같은 품목이 중복되면 수량을 합산하세요.

[출력 형식 (JSON)]
반드시 아래 스키마를 준수하여 순수 JSON만 반환하세요. 마크다운 코드 블록 없이.
{
  "items": [
    {
      "name": "품목명 (예: Gibco FBS 500ml)",
      "catalogNumber": "카탈로그 번호 또는 null",
      "quantity": 1,
      "unit": "EA 또는 BOX 또는 ml 등",
      "category": "REAGENT | CONSUMABLE | EQUIPMENT",
      "estimatedUse": "용도 설명 또는 null",
      "brand": "제조사/브랜드 또는 null"
    }
  ],
  "summary": "총 N개 품목, 카테고리별 분포 요약 한 줄"
}`;

/** API 키 없을 때 간단 로컬 파싱 */
function localBomParse(text: string) {
  const lines = text
    .split(/[\n;,]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const items = lines.map((line, idx) => {
    // 수량 패턴: "3개", "x5", "2 box" 등
    const qtyMatch = line.match(/(\d+)\s*(개|ea|box|병|팩|ml|g|kg|set)/i);
    const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const unit = qtyMatch ? qtyMatch[2].toUpperCase() : "EA";
    const name = line
      .replace(/(\d+)\s*(개|ea|box|병|팩|ml|g|kg|set)/gi, "")
      .replace(/[-·•\d.)\]]/g, "")
      .trim();

    return {
      name: name || line,
      catalogNumber: null,
      quantity,
      unit,
      category: "REAGENT" as const,
      estimatedUse: null,
      brand: null,
    };
  });

  return {
    items: items.filter((i) => i.name.length > 1),
    summary: `총 ${items.length}개 품목 (로컬 파싱 - AI 미사용)`,
  };
}

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'order_create',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/ai/bom-parse',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await req.json();
    const { text } = body as { text: string };

    if (!text || text.trim().length < 3) {
      return NextResponse.json(
        { error: "BOM 텍스트가 필요합니다." },
        { status: 400 }
      );
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        success: true,
        data: localBomParse(text),
        fallback: true,
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const userMessage = `다음 BOM 텍스트를 파싱하여 구조화된 JSON으로 변환해 주세요:\n\n${text.slice(0, 5000)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-04-17",
      contents: [
        {
          role: "user",
          parts: [{ text: BOM_PARSE_SYSTEM_PROMPT + "\n\n" + userMessage }],
        },
      ],
      config: { temperature: 0.1, maxOutputTokens: 4096 },
    });

    const rawText = response.text ?? "";
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // 순수 JSON 파싱 시도
    const fallbackMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (fallbackMatch) jsonStr = fallbackMatch[0];

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[bom-parse] Error:", error);
    return NextResponse.json(
      { error: "BOM 파싱 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
