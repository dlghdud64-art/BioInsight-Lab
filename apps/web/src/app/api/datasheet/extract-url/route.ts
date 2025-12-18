import { NextRequest, NextResponse } from "next/server";
import { extractProductInfoFromDatasheet } from "@/lib/ai/datasheet-extractor";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

// URL에서 데이터시트 본문 추출 및 분석 API
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { error: "Invalid URL protocol. Only http and https are allowed." },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // PDF URL인 경우 PDF 파싱 API로 리다이렉트
    if (url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf?")) {
      try {
        const pdfResponse = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!pdfResponse.ok) {
          return NextResponse.json(
            { error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}` },
            { status: pdfResponse.status }
          );
        }

        const arrayBuffer = await pdfResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // PDF 파싱 API와 동일한 로직 사용
        const { extractTextFromPDF } = await import("@/lib/ai/pdf-parser");
        const pdfText = await extractTextFromPDF(buffer);

        // 텍스트가 너무 길면 앞부분만 사용
        let cleanedText = pdfText;
        if (cleanedText.length > 15000) {
          cleanedText = cleanedText.substring(0, 15000) + "...";
        }

        // 데이터시트 정보 추출
        const extractedInfo = await extractProductInfoFromDatasheet(cleanedText);

        return NextResponse.json({
          success: true,
          data: {
            ...extractedInfo,
            sourceUrl: url,
            extractedTextLength: pdfText.length,
            sourceType: "pdf",
          },
        });
      } catch (pdfError: any) {
        if (pdfError.name === "AbortError") {
          return NextResponse.json(
            { error: "Request timeout. The PDF URL took too long to respond." },
            { status: 408 }
          );
        }
        return NextResponse.json(
          { error: `Failed to process PDF URL: ${pdfError.message}` },
          { status: 500 }
        );
      }
    }

    // URL에서 HTML 가져오기
    let htmlText: string;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        // 타임아웃 설정 (30초)
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
          { status: response.status }
        );
      }

      htmlText = await response.text();
    } catch (error: any) {
      if (error.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timeout. The URL took too long to respond." },
          { status: 408 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch URL: ${error.message}` },
        { status: 500 }
      );
    }

    // Readability를 사용하여 본문 추출
    let textContent: string;
    try {
      const dom = new JSDOM(htmlText, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent) {
        // Readability로 추출된 본문 사용
        textContent = article.textContent.trim();
        
        // 제목과 본문을 결합 (제목도 유용한 정보일 수 있음)
        if (article.title) {
          textContent = `${article.title}\n\n${textContent}`;
        }
      } else {
        // Readability가 실패하면 fallback: 간단한 HTML 파싱
        textContent = htmlText
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    } catch (readabilityError) {
      // Readability 파싱 실패 시 fallback
      console.warn("Readability parsing failed, using fallback:", readabilityError);
      textContent = htmlText
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // 텍스트가 너무 짧으면 에러
    if (textContent.length < 100) {
      return NextResponse.json(
        { error: "Could not extract enough text from the URL. The page might be empty or require JavaScript to render." },
        { status: 400 }
      );
    }

    // 텍스트가 너무 길면 앞부분만 사용 (GPT 토큰 제한 고려)
    const maxLength = 10000;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength) + "...";
    }

    // 추출된 텍스트로 제품 정보 분석
    const extractedInfo = await extractProductInfoFromDatasheet(textContent);

    return NextResponse.json({
      success: true,
      data: {
        ...extractedInfo,
        sourceUrl: url,
        extractedTextLength: textContent.length,
      },
    });
  } catch (error: any) {
    console.error("Error extracting datasheet from URL:", error);
    return NextResponse.json(
      { error: error.message || "Failed to extract datasheet from URL" },
      { status: 500 }
    );
  }
}

