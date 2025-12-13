// protocol-extractor.ts에서 export된 타입 재사용
export type { ExtractedReagent, ProtocolExtractionResult, ExperimentCondition } from "./protocol-extractor";

/**
 * 텍스트에서 실험 프로토콜을 추출하고 필요한 시약을 GPT로 분석
 */
export async function extractReagentsFromText(
  text: string
): Promise<ProtocolExtractionResult> {
  // 텍스트가 너무 길면 요약 (GPT 토큰 제한 고려)
  const truncatedText = text.slice(0, 10000); // 처음 10,000자만 사용

  return extractReagentsFromProtocolText(truncatedText);
}

/**
 * 텍스트에서 직접 시약 추출 (PDF 파싱 없이)
 */
async function extractReagentsFromProtocolText(
  text: string
): Promise<ProtocolExtractionResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const prompt = `다음은 실험 프로토콜 문서입니다. 이 프로토콜에서 필요한 시약, 기구, 장비와 실험 조건(온도, 시간, 농도 등)을 추출해주세요.

프로토콜 내용:
${text}

다음 JSON 형식으로 응답해주세요:
{
  "reagents": [
    {
      "name": "시약명 (예: Human IL-6 ELISA Kit)",
      "description": "사용 목적 또는 설명",
      "quantity": "수량 (예: 50 test)",
      "unit": "단위 (예: test, mL, g)",
      "estimatedUsage": 예상 사용량 (숫자),
      "category": "REAGENT" | "TOOL" | "EQUIPMENT"
    }
  ],
  "summary": "프로토콜 요약 (한 문장)",
  "experimentType": "실험 유형 (예: ELISA, qPCR, Western Blot)",
  "sampleType": "샘플 유형 (예: Serum, Plasma, Cell lysate)",
  "conditions": {
    "temperature": [
      {
        "value": 온도 값 (숫자),
        "unit": "단위 (예: °C, K)",
        "duration": 지속 시간 (분 단위, 선택사항),
        "description": "설명 (예: incubation, storage, reaction)"
      }
    ],
    "time": [
      {
        "value": 시간 값 (숫자),
        "unit": "단위 (예: min, hour, day)",
        "step": "단계 설명 (선택사항)"
      }
    ],
    "concentration": [
      {
        "reagent": "시약명",
        "value": 농도 값 (숫자),
        "unit": "단위 (예: M, mM, μg/mL, %)"
      }
    ],
    "pH": [
      {
        "value": pH 값 (숫자),
        "description": "설명 (선택사항)"
      }
    ],
    "other": [
      {
        "key": "조건 키 (예: rotation speed, pressure)",
        "value": "값",
        "description": "설명 (선택사항)"
      }
    ]
  }
}

시약명은 정확하게 추출하고, 가능하면 제품명이나 키트명을 포함해주세요.
실험 조건은 프로토콜에서 명시된 모든 온도, 시간, 농도, pH 등을 추출해주세요.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 생명과학 실험 프로토콜을 분석하는 전문가입니다. 프로토콜에서 필요한 시약, 기구, 장비를 정확하게 추출합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "GPT API 호출 실패");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    const result = JSON.parse(content) as ProtocolExtractionResult;

    // 소비량 기반 예상 주문량 계산
    result.reagents = result.reagents.map((reagent) => {
      if (reagent.estimatedUsage && reagent.unit) {
        // 예상 사용량의 1.2배를 안전 마진으로 추가
        const recommendedQuantity = Math.ceil(reagent.estimatedUsage * 1.2);
        reagent.estimatedUsage = recommendedQuantity;
      }
      return reagent;
    });

    return result;
  } catch (error) {
    console.error("Error extracting reagents from text:", error);
    throw new Error("프로토콜 분석에 실패했습니다.");
  }
}
