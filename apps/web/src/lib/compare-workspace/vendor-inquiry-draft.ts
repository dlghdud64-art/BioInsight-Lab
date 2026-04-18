/**
 * Vendor Inquiry Draft Generator — V1 최소 구현
 *
 * 비교 결과 맥락에서 공급사 문의 이메일 초안을 생성한다.
 * 가격/납기/규격 차이에 대한 문의가 주요 용도.
 */

import type { DiffResult, DiffItem } from "./03-diff-output-spec";

export interface VendorInquiryDraftResult {
  subject: string;
  body: string;
  inquiryFields: string[];
  vendorName: string;
  productName: string;
  generatedAt: string;
}

/**
 * 비교 결과 기반 공급사 문의 초안 생성
 */
export async function generateVendorInquiryDraft(params: {
  diffResult: DiffResult;
  sourceProductName: string;
  targetProductName: string;
  vendorName: string;
  vendorEmail?: string;
}): Promise<VendorInquiryDraftResult> {
  const { diffResult, sourceProductName, targetProductName, vendorName } = params;

  // 문의할 차이 항목 추출
  const inquiryItems = diffResult.items.filter(
    (i) =>
      i.diffType !== "IDENTICAL" &&
      i.diffType !== "FORMAT_DIFF" &&
      (i.significance === "CRITICAL" || i.significance === "HIGH" || i.significance === "MEDIUM")
  );

  const inquiryFields = inquiryItems.map((i) => i.fieldLabel);

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      return await generateWithAI(params, inquiryItems, inquiryFields);
    } catch (err) {
      console.warn("[VendorInquiry] AI 생성 실패, fallback:", err);
    }
  }

  return generateFallback(params, inquiryItems, inquiryFields);
}

function generateFallback(
  params: {
    sourceProductName: string;
    targetProductName: string;
    vendorName: string;
  },
  inquiryItems: DiffItem[],
  inquiryFields: string[]
): VendorInquiryDraftResult {
  const { sourceProductName, targetProductName, vendorName } = params;

  const itemLines = inquiryItems
    .map((i) => `  - ${i.fieldLabel}: 기존 ${formatVal(i.sourceValue)} → 대상 ${formatVal(i.targetValue)}`)
    .join("\n");

  const subject = `[LabAxis] 제품 비교 관련 문의 — ${targetProductName}`;

  const body = `${vendorName} 담당자님께,

안녕하세요. LabAxis입니다.

현재 사용 중인 "${sourceProductName}"과 "${targetProductName}"을 비교 검토하고 있습니다.
아래 항목에 대해 추가 정보를 확인 부탁드립니다.

[확인 요청 항목]
${itemLines || "  - 일반 제품 정보 문의"}

회신 시 아래 정보를 포함해 주시면 감사하겠습니다:
1. 정확한 단가 및 수량별 할인 조건
2. 예상 납기일
3. 최소 주문 수량
4. 해당 제품의 최신 규격서 또는 SDS

감사합니다.

LabAxis 구매팀`;

  return {
    subject,
    body,
    inquiryFields,
    vendorName,
    productName: targetProductName,
    generatedAt: new Date().toISOString(),
  };
}

async function generateWithAI(
  params: {
    diffResult: DiffResult;
    sourceProductName: string;
    targetProductName: string;
    vendorName: string;
  },
  inquiryItems: DiffItem[],
  inquiryFields: string[]
): Promise<VendorInquiryDraftResult> {
  const { sourceProductName, targetProductName, vendorName } = params;

  const itemDesc = inquiryItems
    .map((i) => `${i.fieldLabel}: A=${formatVal(i.sourceValue)}, B=${formatVal(i.targetValue)}`)
    .join("; ");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 바이오/제약 연구실 구매팀의 이메일 작성 보조입니다.
제품 비교 결과를 바탕으로 공급사에 보낼 문의 이메일 초안을 작성합니다.

응답은 반드시 아래 JSON 형식으로만 반환하세요:
{
  "subject": "이메일 제목",
  "body": "이메일 본문 (한국어, 공손하고 전문적인 톤)"
}

규칙:
- 구체적인 차이 항목을 명시
- 필요한 정보를 명확히 요청
- 간결하고 업무적인 톤 유지`,
        },
        {
          role: "user",
          content: `공급사: ${vendorName}
기존 제품: ${sourceProductName}
비교 대상: ${targetProductName}
차이 항목: ${itemDesc || "일반 정보 확인"}
문의 목적: 제품 대체 검토를 위한 추가 정보 확인`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 800,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) throw new Error("OpenAI API error");

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  return {
    subject: parsed.subject || `[LabAxis] ${targetProductName} 문의`,
    body: parsed.body || "",
    inquiryFields,
    vendorName,
    productName: targetProductName,
    generatedAt: new Date().toISOString(),
  };
}

function formatVal(val: unknown): string {
  if (val == null) return "(정보 없음)";
  if (typeof val === "number") return val.toLocaleString("ko-KR");
  return String(val);
}
