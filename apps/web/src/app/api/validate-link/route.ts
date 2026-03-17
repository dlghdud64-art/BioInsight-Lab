import { NextRequest, NextResponse } from "next/server";

// 링크 유효성 검증 API
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

    // URL 형식 검사
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return NextResponse.json({
        valid: false,
        error: "Invalid URL format",
      });
    }

    try {
      // HEAD 요청으로 링크 유효성 검사 (타임아웃 5초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BioInsightLab/1.0)",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      // 2xx, 3xx 상태 코드는 유효한 것으로 간주
      const isValid = response.status >= 200 && response.status < 400;

      return NextResponse.json({
        valid: isValid,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
      });
    } catch (fetchError: any) {
      // 네트워크 오류, 타임아웃, CORS 오류 등
      if (fetchError.name === "AbortError") {
        return NextResponse.json({
          valid: false,
          error: "Request timeout",
        });
      }

      // CORS 오류는 링크가 존재할 수 있지만 검증할 수 없는 경우
      // 이런 경우는 일단 유효한 것으로 간주 (사용자가 직접 확인)
      if (fetchError.message?.includes("CORS") || fetchError.message?.includes("fetch")) {
        return NextResponse.json({
          valid: true,
          warning: "Could not verify due to CORS policy",
        });
      }

      return NextResponse.json({
        valid: false,
        error: fetchError.message || "Failed to validate link",
      });
    }
  } catch (error: any) {
    console.error("Error validating link:", error);
    return NextResponse.json(
      { error: "Failed to validate link", valid: false },
      { status: 500 }
    );
  }
}

