/**
 * Quote Draft Generator — AI 견적 요청 초안 생성 모듈
 *
 * GPT-4o를 사용하여 선택된 품목 기반으로 공식 한국어 RFQ 이메일 초안을 생성합니다.
 * 기존 openai.ts 패턴 (fetch + AbortController + fallback) 준수.
 */

export interface QuoteDraftItem {
  productName: string;
  catalogNumber?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  specifications?: string;
}

export interface QuoteDraftRequest {
  items: QuoteDraftItem[];
  vendorNames?: string[];
  deliveryDate?: string; // ISO date
  organizationName?: string;
  requesterName?: string;
  additionalNotes?: string;
}

export interface QuoteDraftResult {
  emailSubject: string;
  emailBody: string;
  items: QuoteDraftItem[];
  vendorNames: string[];
  suggestedDeliveryDate: string;
  aiModel: string;
  promptTokens: number;
  completionTokens: number;
}

export interface VendorEmailDraftRequest {
  vendorName: string;
  vendorEmail?: string;
  items: QuoteDraftItem[];
  deliveryDate?: string;
  organizationName?: string;
  requesterName?: string;
  customMessage?: string;
}

export interface VendorEmailDraftResult {
  emailSubject: string;
  emailBody: string;
  vendorName: string;
  aiModel: string;
  promptTokens: number;
  completionTokens: number;
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const AI_MODEL = "gpt-4o";
const TIMEOUT_MS = 15000;

/**
 * RFQ 이메일 초안 생성
 */
export async function generateQuoteDraft(
  request: QuoteDraftRequest
): Promise<QuoteDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiKeyMissingError();
  }

  const itemsTable = request.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.productName}${item.catalogNumber ? ` (Cat# ${item.catalogNumber})` : ""}${item.brand ? ` [${item.brand}]` : ""} — ${item.quantity}${item.unit || "ea"}`
    )
    .join("\n");

  const vendorList = request.vendorNames?.length
    ? request.vendorNames.join(", ")
    : "미지정 (자동 매칭)";

  const deliveryDate =
    request.deliveryDate || getDefaultDeliveryDate();

  const systemPrompt = `당신은 바이오·제약 연구실의 구매 담당자를 대신하여 공급사에 보내는 견적요청서(RFQ) 이메일 초안을 작성하는 전문가입니다.

규칙:
1. 공식적이고 간결한 한국어 비즈니스 이메일 형식
2. 제목은 "[견적요청] {대표 품목명} 외 {N-1}건" 형식
3. 본문에 품목 테이블 포함 (번호, 품명, 카탈로그번호, 수량)
4. 희망 납기일 명시
5. 단가 및 납기 회신 요청 문구 포함
6. 서명란에 조직명·담당자명 포함 (제공된 경우)
7. 불필요한 인사말 최소화, 핵심 내용 위주

JSON 형식으로만 응답하세요:
{
  "emailSubject": "이메일 제목",
  "emailBody": "이메일 본문 (줄바꿈은 \\n 사용)",
  "suggestedDeliveryDate": "YYYY-MM-DD"
}`;

  const userPrompt = `아래 품목에 대해 견적요청 이메일 초안을 작성해주세요.

품목 목록:
${itemsTable}

대상 공급사: ${vendorList}
희망 납기일: ${deliveryDate}
${request.organizationName ? `조직명: ${request.organizationName}` : ""}
${request.requesterName ? `담당자: ${request.requesterName}` : ""}
${request.additionalNotes ? `추가 요청사항: ${request.additionalNotes}` : ""}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content);
    const usage = data.usage || {};

    return {
      emailSubject: parsed.emailSubject || `[견적요청] ${request.items[0]?.productName || "품목"} 외 ${Math.max(0, request.items.length - 1)}건`,
      emailBody: parsed.emailBody || "",
      items: request.items,
      vendorNames: request.vendorNames || [],
      suggestedDeliveryDate: parsed.suggestedDeliveryDate || deliveryDate,
      aiModel: AI_MODEL,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof AiKeyMissingError) throw err;

    // Fallback: 템플릿 기반 초안 생성
    console.warn("[QuoteDraftGenerator] AI 호출 실패, 템플릿 폴백:", err);
    return generateFallbackDraft(request, deliveryDate);
  }
}

/**
 * 벤더별 이메일 초안 생성
 */
export async function generateVendorEmailDraft(
  request: VendorEmailDraftRequest
): Promise<VendorEmailDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiKeyMissingError();
  }

  const itemsTable = request.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.productName}${item.catalogNumber ? ` (${item.catalogNumber})` : ""} — ${item.quantity}${item.unit || "ea"}`
    )
    .join("\n");

  const systemPrompt = `당신은 바이오·제약 분야의 구매 담당자입니다. 특정 공급사에 보내는 견적 요청 이메일을 작성합니다.

규칙:
1. 공식 한국어 비즈니스 이메일 형식
2. 해당 벤더명을 수신인으로 지정
3. 품목별 단가, 납기, MOQ(최소주문수량), 재고 여부 회신 요청
4. 간결하고 명확하게 작성

JSON 형식으로만 응답:
{
  "emailSubject": "이메일 제목",
  "emailBody": "이메일 본문"
}`;

  const userPrompt = `${request.vendorName}에 아래 품목의 견적을 요청하는 이메일을 작성해주세요.

품목:
${itemsTable}

희망 납기: ${request.deliveryDate || getDefaultDeliveryDate()}
${request.organizationName ? `발신: ${request.organizationName}` : ""}
${request.requesterName ? `담당: ${request.requesterName}` : ""}
${request.customMessage ? `추가 메시지: ${request.customMessage}` : ""}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content);
    const usage = data.usage || {};

    return {
      emailSubject: parsed.emailSubject || `[견적요청] ${request.vendorName} - ${request.items.length}건`,
      emailBody: parsed.emailBody || "",
      vendorName: request.vendorName,
      aiModel: AI_MODEL,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof AiKeyMissingError) throw err;

    console.warn("[VendorEmailDraftGenerator] AI 호출 실패, 템플릿 폴백:", err);
    return generateFallbackVendorEmail(request);
  }
}

// ── Helpers ──

function getDefaultDeliveryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14); // 2주 후
  return d.toISOString().split("T")[0];
}

function generateFallbackDraft(
  request: QuoteDraftRequest,
  deliveryDate: string
): QuoteDraftResult {
  const itemsTable = request.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.productName}${item.catalogNumber ? ` (Cat# ${item.catalogNumber})` : ""} — 수량: ${item.quantity}${item.unit || "ea"}`
    )
    .join("\n");

  const representative = request.items[0]?.productName || "품목";
  const otherCount = Math.max(0, request.items.length - 1);

  return {
    emailSubject: `[견적요청] ${representative}${otherCount > 0 ? ` 외 ${otherCount}건` : ""}`,
    emailBody: `안녕하세요.

아래 품목에 대해 견적을 요청드립니다.

[요청 품목]
${itemsTable}

희망 납기일: ${deliveryDate}

각 품목별 단가, 납기, 재고 여부를 회신해 주시면 감사하겠습니다.

감사합니다.
${request.organizationName ? `\n${request.organizationName}` : ""}${request.requesterName ? ` ${request.requesterName}` : ""}`,
    items: request.items,
    vendorNames: request.vendorNames || [],
    suggestedDeliveryDate: deliveryDate,
    aiModel: "fallback-template",
    promptTokens: 0,
    completionTokens: 0,
  };
}

function generateFallbackVendorEmail(
  request: VendorEmailDraftRequest
): VendorEmailDraftResult {
  const itemsTable = request.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.productName}${item.catalogNumber ? ` (${item.catalogNumber})` : ""} — ${item.quantity}${item.unit || "ea"}`
    )
    .join("\n");

  return {
    emailSubject: `[견적요청] ${request.vendorName} - ${request.items.length}건`,
    emailBody: `${request.vendorName} 담당자님께,

아래 품목에 대해 견적을 요청드립니다.

${itemsTable}

희망 납기: ${request.deliveryDate || getDefaultDeliveryDate()}

단가, 납기, MOQ, 재고 여부를 회신 부탁드립니다.

감사합니다.
${request.organizationName || ""}${request.requesterName ? ` ${request.requesterName}` : ""}`,
    vendorName: request.vendorName,
    aiModel: "fallback-template",
    promptTokens: 0,
    completionTokens: 0,
  };
}

// ── Custom Errors ──

export class AiKeyMissingError extends Error {
  constructor() {
    super("AI 기능을 사용하려면 API 키 설정이 필요합니다");
    this.name = "AiKeyMissingError";
  }
}
