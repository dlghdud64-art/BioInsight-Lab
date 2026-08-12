import { NextRequest, NextResponse } from "next/server";
import { getExchangeRates, convertToKRW } from "@/lib/api/exchange-rate";

// íì¨ ì¡°í API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromCurrency = searchParams.get("from");
    const toCurrency = searchParams.get("to") || "KRW";
    const amount = searchParams.get("amount");

    // í¹ì  íµí ë³í ìì²­
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

    // ì ì²´ íì¨ ì ë³´ ë°í
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

