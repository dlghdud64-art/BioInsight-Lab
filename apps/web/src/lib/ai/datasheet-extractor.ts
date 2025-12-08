// 데이터시트 텍스트에서 제품 정보 추출

export interface ExtractedProductInfo {
  name?: string;
  nameEn?: string;
  target?: string; // 타깃 (예: Human IL-6)
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
  capacity?: string; // 용량 (예: 1mg, 500mL)
  grade?: string; // Grade (예: cell culture tested, GMP)
  specifications?: Record<string, string>; // 규격 정보
  description?: string; // 한글 요약
  descriptionEn?: string; // 영문 설명
  summary?: string; // 한글 요약
}

/**
 * 데이터시트 텍스트에서 제품 정보를 추출하고 한글 요약/번역 생성
 */
export async function extractProductInfoFromDatasheet(
  text: string
): Promise<ExtractedProductInfo> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  // 텍스트가 너무 길면 요약 (GPT 토큰 제한 고려)
  const truncatedText = text.slice(0, 15000); // 처음 15,000자만 사용

  const prompt = `다음은 바이오·제약 제품의 데이터시트 텍스트입니다. 이 텍스트에서 제품 정보를 추출하고 한글로 요약해주세요.

데이터시트 텍스트:
${truncatedText}

다음 JSON 형식으로 응답해주세요:
{
  "name": "제품명 (한글, 가능한 경우)",
  "nameEn": "제품명 (영문)",
  "target": "타깃/Analyte (예: Human IL-6, Mouse IgG)",
  "category": "REAGENT" | "TOOL" | "EQUIPMENT",
  "capacity": "용량/규격 (예: 1mg, 500mL, 96-well plate)",
  "grade": "Grade/규격 (예: cell culture tested, GMP, analytical grade)",
  "specifications": {
    "키1": "값1",
    "키2": "값2"
  },
  "description": "제품 설명 (한글, 2-3문장 요약)",
  "descriptionEn": "제품 설명 (영문, 원문에서 추출)",
  "summary": "한글 요약 (주요 특징, 용도, 사용법 등을 간단히)"
}

중요:
- 제품명은 정확하게 추출하세요
- 타깃(Analyte)이 있으면 명시하세요 (ELISA kit, 항체 등)
- 용량/규격 정보를 정확히 추출하세요
- Grade/규격 정보가 있으면 명시하세요
- specifications에는 주요 스펙을 키-값 쌍으로 정리하세요
- description과 summary는 한글로 작성하되, 전문 용어는 원문을 괄호로 표기하세요
- 불확실한 정보는 null 또는 빈 문자열로 반환하세요

JSON만 반환하고 다른 설명은 하지 마세요.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 바이오·제약 제품 데이터시트를 분석하는 전문가입니다. 데이터시트에서 제품 정보를 정확하게 추출하고 한글로 요약합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || "GPT API 호출 실패");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    const result = JSON.parse(content) as ExtractedProductInfo;

    return result;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI API timeout");
      throw new Error("데이터시트 분석 시간이 초과되었습니다.");
    } else {
      console.error("Error extracting product info from datasheet:", error);
      throw new Error("데이터시트 분석에 실패했습니다.");
    }
  }
}


export interface ExtractedProductInfo {
  name?: string;
  nameEn?: string;
  target?: string; // 타깃 (예: Human IL-6)
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
  capacity?: string; // 용량 (예: 1mg, 500mL)
  grade?: string; // Grade (예: cell culture tested, GMP)
  specifications?: Record<string, string>; // 규격 정보
  description?: string; // 한글 요약
  descriptionEn?: string; // 영문 설명
  summary?: string; // 한글 요약
}

/**
 * 데이터시트 텍스트에서 제품 정보를 추출하고 한글 요약/번역 생성
 */
export async function extractProductInfoFromDatasheet(
  text: string
): Promise<ExtractedProductInfo> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  // 텍스트가 너무 길면 요약 (GPT 토큰 제한 고려)
  const truncatedText = text.slice(0, 15000); // 처음 15,000자만 사용

  const prompt = `다음은 바이오·제약 제품의 데이터시트 텍스트입니다. 이 텍스트에서 제품 정보를 추출하고 한글로 요약해주세요.

데이터시트 텍스트:
${truncatedText}

다음 JSON 형식으로 응답해주세요:
{
  "name": "제품명 (한글, 가능한 경우)",
  "nameEn": "제품명 (영문)",
  "target": "타깃/Analyte (예: Human IL-6, Mouse IgG)",
  "category": "REAGENT" | "TOOL" | "EQUIPMENT",
  "capacity": "용량/규격 (예: 1mg, 500mL, 96-well plate)",
  "grade": "Grade/규격 (예: cell culture tested, GMP, analytical grade)",
  "specifications": {
    "키1": "값1",
    "키2": "값2"
  },
  "description": "제품 설명 (한글, 2-3문장 요약)",
  "descriptionEn": "제품 설명 (영문, 원문에서 추출)",
  "summary": "한글 요약 (주요 특징, 용도, 사용법 등을 간단히)"
}

중요:
- 제품명은 정확하게 추출하세요
- 타깃(Analyte)이 있으면 명시하세요 (ELISA kit, 항체 등)
- 용량/규격 정보를 정확히 추출하세요
- Grade/규격 정보가 있으면 명시하세요
- specifications에는 주요 스펙을 키-값 쌍으로 정리하세요
- description과 summary는 한글로 작성하되, 전문 용어는 원문을 괄호로 표기하세요
- 불확실한 정보는 null 또는 빈 문자열로 반환하세요

JSON만 반환하고 다른 설명은 하지 마세요.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 바이오·제약 제품 데이터시트를 분석하는 전문가입니다. 데이터시트에서 제품 정보를 정확하게 추출하고 한글로 요약합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || "GPT API 호출 실패");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    const result = JSON.parse(content) as ExtractedProductInfo;

    return result;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI API timeout");
      throw new Error("데이터시트 분석 시간이 초과되었습니다.");
    } else {
      console.error("Error extracting product info from datasheet:", error);
      throw new Error("데이터시트 분석에 실패했습니다.");
    }
  }
}


export interface ExtractedProductInfo {
  name?: string;
  nameEn?: string;
  target?: string; // 타깃 (예: Human IL-6)
  category?: "REAGENT" | "TOOL" | "EQUIPMENT";
  capacity?: string; // 용량 (예: 1mg, 500mL)
  grade?: string; // Grade (예: cell culture tested, GMP)
  specifications?: Record<string, string>; // 규격 정보
  description?: string; // 한글 요약
  descriptionEn?: string; // 영문 설명
  summary?: string; // 한글 요약
}

/**
 * 데이터시트 텍스트에서 제품 정보를 추출하고 한글 요약/번역 생성
 */
export async function extractProductInfoFromDatasheet(
  text: string
): Promise<ExtractedProductInfo> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  // 텍스트가 너무 길면 요약 (GPT 토큰 제한 고려)
  const truncatedText = text.slice(0, 15000); // 처음 15,000자만 사용

  const prompt = `다음은 바이오·제약 제품의 데이터시트 텍스트입니다. 이 텍스트에서 제품 정보를 추출하고 한글로 요약해주세요.

데이터시트 텍스트:
${truncatedText}

다음 JSON 형식으로 응답해주세요:
{
  "name": "제품명 (한글, 가능한 경우)",
  "nameEn": "제품명 (영문)",
  "target": "타깃/Analyte (예: Human IL-6, Mouse IgG)",
  "category": "REAGENT" | "TOOL" | "EQUIPMENT",
  "capacity": "용량/규격 (예: 1mg, 500mL, 96-well plate)",
  "grade": "Grade/규격 (예: cell culture tested, GMP, analytical grade)",
  "specifications": {
    "키1": "값1",
    "키2": "값2"
  },
  "description": "제품 설명 (한글, 2-3문장 요약)",
  "descriptionEn": "제품 설명 (영문, 원문에서 추출)",
  "summary": "한글 요약 (주요 특징, 용도, 사용법 등을 간단히)"
}

중요:
- 제품명은 정확하게 추출하세요
- 타깃(Analyte)이 있으면 명시하세요 (ELISA kit, 항체 등)
- 용량/규격 정보를 정확히 추출하세요
- Grade/규격 정보가 있으면 명시하세요
- specifications에는 주요 스펙을 키-값 쌍으로 정리하세요
- description과 summary는 한글로 작성하되, 전문 용어는 원문을 괄호로 표기하세요
- 불확실한 정보는 null 또는 빈 문자열로 반환하세요

JSON만 반환하고 다른 설명은 하지 마세요.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 바이오·제약 제품 데이터시트를 분석하는 전문가입니다. 데이터시트에서 제품 정보를 정확하게 추출하고 한글로 요약합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || "GPT API 호출 실패");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("GPT 응답이 비어있습니다.");
    }

    const result = JSON.parse(content) as ExtractedProductInfo;

    return result;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI API timeout");
      throw new Error("데이터시트 분석 시간이 초과되었습니다.");
    } else {
      console.error("Error extracting product info from datasheet:", error);
      throw new Error("데이터시트 분석에 실패했습니다.");
    }
  }
}



