import { extractTextFromPDF } from "./pdf-parser";
import { parseAiJsonResponse } from "./json-cleaner";

// 중복 정의 제거 - OpenAI API 직접 호출 (openai 패키지 대신 fetch 사용)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface ExtractedReagent {
  name: string;
  description?: string;
  quantity?: string;
  unit?: string;
  estimatedUsage?: number;
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
}

export interface ExperimentCondition {
  temperature?: {
    value: number;
    unit: string; // "°C", "K" 등
    duration?: number; // 분 단위
    description?: string; // "incubation", "storage" 등
  }[];
  time?: {
    value: number;
    unit: string; // "min", "hour", "day" 등
    step?: string; // 단계 설명
  }[];
  concentration?: {
    reagent: string; // 시약명
    value: number;
    unit: string; // "M", "mM", "μg/mL", "%" 등
  }[];
  pH?: {
    value: number;
    description?: string;
  }[];
  other?: {
    key: string;
    value: string;
    description?: string;
  }[];
}

export interface ProtocolExtractionResult {
  reagents: ExtractedReagent[];
  summary: string;
  experimentType?: string;
  sampleType?: string;
  conditions?: ExperimentCondition; // 실험 조건
}

/**
 * PDF에서 실험 프로토콜을 추출하고 필요한 시약을 GPT로 분석
 *
 * ZDR (Zero Data Retention) 준수:
 * - 모든 텍스트 변수는 함수 종료 시 명시적으로 null 처리
 * - 에러 로깅 시 민감 데이터 제외
 */
export async function extractReagentsFromProtocol(
  pdfBuffer: Buffer
): Promise<ProtocolExtractionResult> {
  // ZDR: 민감 데이터를 담는 변수들 (함수 종료 시 null 처리)
  let pdfText: string | null = null;
  let cleanedText: string | null = null;
  let truncatedText: string | null = null;
  let prompt: string | null = null;

  try {
    // PDF에서 텍스트 추출
    pdfText = await extractTextFromPDF(pdfBuffer);

    // 텍스트 전처리: 표 구조 보존하면서 정리
    // 탭 문자는 표 구분자로 사용되므로 보존
    cleanedText = pdfText;

    // 연속된 공백을 하나로 (단, 탭은 보존)
    cleanedText = cleanedText.replace(/[ \t]+/g, (match) => {
      if (match.includes("\t")) {
        return "\t";
      }
      return " ";
    });

    // 줄바꿈 정리
    cleanedText = cleanedText.replace(/\r\n/g, "\n");
    cleanedText = cleanedText.replace(/\r/g, "\n");

    // 연속된 줄바꿈 정리 (표 구조는 보존)
    cleanedText = cleanedText.replace(/\n{4,}/g, "\n\n\n");

    cleanedText = cleanedText.trim();

    // 텍스트가 너무 길면 요약 (GPT 토큰 제한 고려)
    // 표나 리스트가 포함된 경우 더 많은 텍스트 필요
    truncatedText = cleanedText.slice(0, 15000); // 처음 15,000자로 증가

    // GPT를 사용하여 시약 및 실험 조건 추출
    prompt = `다음은 실험 프로토콜 문서입니다. 이 프로토콜에서 필요한 시약, 기구, 장비와 실험 조건(온도, 시간, 농도 등)을 추출해주세요.

중요 지침:
1. 표(table)나 리스트 형식으로 나열된 시약도 모두 추출하세요.
   - 탭(\t)이나 여러 공백으로 구분된 열을 표로 인식하세요.
   - 표의 각 행을 개별 시약으로 추출하세요.
   - 표 헤더(예: "시약명", "농도", "부피")를 참고하여 정보를 매핑하세요.
2. 농도, 부피, 온도, 시간 등 숫자와 단위를 정확하게 추출하세요.
   - 표 형식의 데이터에서도 숫자와 단위를 정확히 추출하세요.
3. 제품명, 키트명, 브랜드명이 있으면 포함하세요.
4. 실험 조건은 프로토콜의 각 단계별로 추출하세요.
5. 복잡한 조건 표현식도 정확하게 파싱하세요:
   - 범위 표현: "2-8°C", "37±2°C", "4-37°C" → value는 평균값 또는 첫 번째 값 사용, originalExpression에 원본 저장
   - 시간 표현: "2시간", "30분", "하룻밤", "overnight", "RT에서 30분" → 모두 분 단위로 변환 (overnight = 12시간 = 720분)
   - 온도 표현: "RT" (room temperature) → 20-25°C, "4°C", "37°C" 등
   - 농도 표현: "1M", "10mM", "0.1%", "1:1000" → 정확한 숫자와 단위 추출
6. 단계별 조건을 구분하여 추출하세요 (예: Step 1: 37°C 2시간, Step 2: 4°C 하룻밤)
7. 표나 리스트에서 여러 행에 걸쳐 있는 정보도 모두 추출하세요.

프로토콜 내용:
${truncatedText}

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
        "value": 온도 값 (숫자, 범위인 경우 평균값 또는 첫 번째 값),
        "unit": "단위 (예: °C, K)",
        "duration": 지속 시간 (분 단위, 선택사항),
        "description": "설명 (예: incubation, storage, reaction)",
        "range": "범위 표현이 있으면 문자열로 저장 (예: '2-8°C', '37±2°C')"
      }
    ],
    "time": [
      {
        "value": 시간 값 (숫자, 분 단위로 변환),
        "unit": "단위 (예: min, hour, day)",
        "step": "단계 설명 (선택사항)",
        "original": "원본 표현 (예: '하룻밤', 'overnight', 'RT에서 30분')"
      }
    ],
    "concentration": [
      {
        "reagent": "시약명",
        "value": 농도 값 (숫자),
        "unit": "단위 (예: M, mM, μg/mL, %, ratio)",
        "original": "원본 표현 (예: '1:1000', '0.1%')"
      }
    ],
    "pH": [
      {
        "value": pH 값 (숫자),
        "description": "설명 (선택사항)",
        "range": "범위 표현이 있으면 문자열로 저장 (예: '7.2-7.4')"
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
실험 조건은 프로토콜에서 명시된 모든 온도, 시간, 농도, pH 등을 추출해주세요.
표나 리스트 형식의 데이터도 정확하게 파싱하여 추출하세요.

특별 주의사항:
- "RT" (room temperature)는 20-25°C로 해석
- "하룻밤", "overnight"는 12-16시간 (720-960분)으로 변환
- "실온"은 20-25°C로 해석
- 범위 표현은 value에 평균값 또는 첫 번째 값 사용, range 필드에 원본 저장
- 시간 단위 변환: 1시간=60분, 1일=1440분
- 농도 비율 표현 (예: "1:1000")은 value에 분자값, unit에 "ratio" 저장`;

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

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
              "당신은 생명과학 실험 프로토콜을 분석하는 전문가입니다. 프로토콜에서 필요한 시약, 기구, 장비를 정확하게 추출합니다.\n\nIMPORTANT: Return raw JSON only. Do not use markdown formatting like ```json or ```. Do not include any explanatory text before or after the JSON. Your response must start with { and end with }.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2, // 더 정확한 추출을 위해 온도 낮춤
        max_tokens: 2000, // 더 많은 토큰 할당
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

    // JSON 클리닝 및 파싱 (마크다운 코드블록 등 제거)
    const result = parseAiJsonResponse<ProtocolExtractionResult>(
      content,
      "Protocol Extractor"
    );

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
    // ZDR: 에러 로깅 시 민감 데이터 제외 (타임스탬프만 기록)
    console.error("[Protocol Extractor] Extraction failed at:", new Date().toISOString());
    throw new Error("프로토콜 분석에 실패했습니다.");
  } finally {
    // ZDR: 민감 데이터 명시적 null 처리 (메모리 휘발성 보장)
    pdfText = null;
    cleanedText = null;
    truncatedText = null;
    prompt = null;
  }
}
