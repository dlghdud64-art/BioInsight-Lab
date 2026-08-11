import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 요청용 영문 텍스트 생성 (GPT 활용)
export async function POST(request: NextRequest) {
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
      targetEntityType: 'quote',
      // §enforcement-handle-close-sweep (quotes) — 'unknown' 유지. 품목 배열로 영문 견적 문안을 생성할 뿐
      //   대상 견적 엔티티가 없다(quoteId 미수신). 'unknown' 은 전역 공용 키가 아니라
      //   userId 폴백(§11.369-3)이라 같은 사용자의 연타 보호는 유지된다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/quotes/generate-english',
    });
    if (!enforcement.allowed) return enforcement.deny();


    const body = await request.json();
    const {
      title,
      message,
      deliveryDate,
      deliveryLocation,
      specialNotes,
      items,
    } = body;

    if (!items || items.length === 0) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 }
      );
    }

    // 제품 정보 조회
    const productIds = items.map((item: any) => item.productId).filter(Boolean);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: {
        vendors: {
          include: {
            vendor: true,
          },
          take: 1,
        },
      },
    });

    // 제품 정보를 맵으로 변환
    // 타입 에러 수정: p 파라미터에 타입 명시
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // GPT에 전달할 제품 정보 구성
    const itemsDescription = items
      .map((item: any, index: number) => {
        // 타입 에러 수정: productMap.get()의 반환 타입이 제대로 추론되지 않아 타입 캐스팅 추가
        const product = productMap.get(item.productId) as any;
        if (!product) return null;

        const vendor = product.vendors?.[0]?.vendor;
        return `${index + 1}. ${product.nameEn || product.name}
   - Catalog Number: ${product.catalogNumber || "N/A"}
   - Brand: ${product.brand || "N/A"}
   - Specification: ${product.specification || "N/A"}
   - Grade: ${product.grade || "N/A"}
   - Quantity: ${item.quantity || 1}
   - Notes: ${item.notes || "None"}`;
      })
      .filter(Boolean)
      .join("\n\n");

    // GPT 프롬프트 구성
    const prompt = `You are a professional procurement specialist writing a formal quotation request email in English for biotechnology and pharmaceutical research products.

Please generate a professional, clear, and concise quotation request email based on the following information:

**Request Title:** ${title || "Product Quotation Request"}

**Request Message:** ${message || "Please provide a quotation for the following products."}

**Delivery Date:** ${deliveryDate || "To be discussed"}

**Delivery Location:** ${deliveryLocation || "To be confirmed"}

**Special Notes:** ${specialNotes || "None"}

**Product List:**
${itemsDescription}

Requirements:
1. Use formal business English
2. Include all product details clearly
3. Request pricing, availability, and lead time for each item
4. Mention delivery date and location if provided
5. Include any special requirements or notes
6. Keep it professional and concise
7. Format as a ready-to-send email body

Generate only the email body text, without subject line or email headers.`;

    // OpenAI API 호출
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      enforcement.fail();
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

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
            content: `You are a professional procurement specialist writing formal quotation request emails in English for biotechnology and pharmaceutical research products. 
Your emails should be:
- Professional and courteous
- Clear and concise
- Include all necessary product details
- Request pricing, availability, and lead time
- Follow standard business email format`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const englishText = data.choices[0].message.content.trim();

    // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
    //   AI 로 문안을 생성해 반환할 뿐 DB 쓰기가 0이다. complete() 는 before/after 를 남기므로
    //   아무것도 바꾸지 않은 호출에 "변경 완료" 감사가 생긴다 = 거짓 감사.
    enforcement.fail();
    return NextResponse.json({
      englishText,
      subject: `Quotation Request: ${title || "Product Quotation"}`,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error generating English text:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate English text",
      },
      { status: 500 }
    );
  }
}
