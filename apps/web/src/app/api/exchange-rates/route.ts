import { NextRequest, NextResponse } from "next/server";
import { getExchangeRates, convertToKRW } from "@/lib/api/exchange-rate";

// 환율 조회 API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromCurrency = searchParams.get("from");
    const toCurrency = searchParams.get("to") || "KRW";
    const amount = searchParams.get("amount");

    // 특정 통화 변환 요청
    if (fromCurrency && amount) {
      const converted = await convertToKRW(
        parseFloat(amount),
        fromCurrency
      );
      return NextResponse.json({
        from: fromCurrency,
        to: toCurrency,
        amount: parseFloat(amount),
        converted,
      });
    }

    // 전체 환율 정보 반환
    const rates = await getExchangeRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}



import { getExchangeRates, convertToKRW } from "@/lib/api/exchange-rate";

// 환율 조회 API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromCurrency = searchParams.get("from");
    const toCurrency = searchParams.get("to") || "KRW";
    const amount = searchParams.get("amount");

    // 특정 통화 변환 요청
    if (fromCurrency && amount) {
      const converted = await convertToKRW(
        parseFloat(amount),
        fromCurrency
      );
      return NextResponse.json({
        from: fromCurrency,
        to: toCurrency,
        amount: parseFloat(amount),
        converted,
      });
    }

    // 전체 환율 정보 반환
    const rates = await getExchangeRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}



import { getExchangeRates, convertToKRW } from "@/lib/api/exchange-rate";

// 환율 조회 API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromCurrency = searchParams.get("from");
    const toCurrency = searchParams.get("to") || "KRW";
    const amount = searchParams.get("amount");

    // 특정 통화 변환 요청
    if (fromCurrency && amount) {
      const converted = await convertToKRW(
        parseFloat(amount),
        fromCurrency
      );
      return NextResponse.json({
        from: fromCurrency,
        to: toCurrency,
        amount: parseFloat(amount),
        converted,
      });
    }

    // 전체 환율 정보 반환
    const rates = await getExchangeRates();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    );
  }
}






