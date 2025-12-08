import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 요청용 영문 텍스트 생성 (GPT 활용)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const productMap = new Map(products.map((p) => [p.id, p]));

    // GPT에 전달할 제품 정보 구성
    const itemsDescription = items
      .map((item: any, index: number) => {
        const product = productMap.get(item.productId);
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

    return NextResponse.json({
      englishText,
      subject: `Quotation Request: ${title || "Product Quotation"}`,
    });
  } catch (error: any) {
    console.error("Error generating English text:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate English text",
      },
      { status: 500 }
    );
  }
}


import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 요청용 영문 텍스트 생성 (GPT 활용)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const productMap = new Map(products.map((p) => [p.id, p]));

    // GPT에 전달할 제품 정보 구성
    const itemsDescription = items
      .map((item: any, index: number) => {
        const product = productMap.get(item.productId);
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

    return NextResponse.json({
      englishText,
      subject: `Quotation Request: ${title || "Product Quotation"}`,
    });
  } catch (error: any) {
    console.error("Error generating English text:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate English text",
      },
      { status: 500 }
    );
  }
}


import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 요청용 영문 텍스트 생성 (GPT 활용)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const productMap = new Map(products.map((p) => [p.id, p]));

    // GPT에 전달할 제품 정보 구성
    const itemsDescription = items
      .map((item: any, index: number) => {
        const product = productMap.get(item.productId);
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

    return NextResponse.json({
      englishText,
      subject: `Quotation Request: ${title || "Product Quotation"}`,
    });
  } catch (error: any) {
    console.error("Error generating English text:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate English text",
      },
      { status: 500 }
    );
  }
}





