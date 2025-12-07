// 환율 API 유틸리티
// ExchangeRate-API (https://www.exchangerate-api.com/) 또는 다른 무료 API 사용

interface ExchangeRates {
  [currency: string]: number; // KRW 기준 환율
}

// 메모리 캐시 (1시간 TTL)
let cachedRates: ExchangeRates | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1시간

// 환율 조회 (KRW 기준)
export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();
  
  // 캐시 확인
  if (cachedRates && now - cacheTimestamp < CACHE_TTL) {
    return cachedRates;
  }

  try {
    // ExchangeRate-API 사용 (무료 플랜: 1,500 requests/month)
    // 또는 다른 무료 API 사용 가능
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    
    if (!apiKey) {
      console.warn("EXCHANGE_RATE_API_KEY가 설정되지 않았습니다. 기본 환율을 사용합니다.");
      // 기본 환율 (대략적인 값, 실제로는 API에서 가져와야 함)
      return getDefaultRates();
    }

    // ExchangeRate-API v6 (KRW 기준)
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/KRW`,
      {
        next: { revalidate: 3600 }, // 1시간 캐시
      }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result === "success" && data.conversion_rates) {
      // KRW 기준이므로 역수로 변환 필요
      const rates: ExchangeRates = {};
      const krwRate = data.conversion_rates.KRW || 1;
      
      for (const [currency, rate] of Object.entries(data.conversion_rates)) {
        // KRW를 기준으로 변환 (1 KRW = rate USD 등)
        // 다른 통화를 KRW로 변환하려면: 1 / rate
        rates[currency] = currency === "KRW" ? 1 : 1 / (rate as number);
      }
      
      cachedRates = rates;
      cacheTimestamp = now;
      return rates;
    } else {
      throw new Error("Invalid exchange rate API response");
    }
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    // 에러 시 기본 환율 반환
    return getDefaultRates();
  }
}

// 기본 환율 (API 실패 시 사용)
function getDefaultRates(): ExchangeRates {
  return {
    KRW: 1,
    USD: 0.00075, // 1 KRW = 0.00075 USD (대략 1 USD = 1,333 KRW)
    EUR: 0.00069, // 1 KRW = 0.00069 EUR
    GBP: 0.00059, // 1 KRW = 0.00059 GBP
    JPY: 0.11, // 1 KRW = 0.11 JPY
    CNY: 0.0054, // 1 KRW = 0.0054 CNY
  };
}

// 통화를 KRW로 변환
export async function convertToKRW(
  amount: number,
  fromCurrency: string
): Promise<number> {
  if (fromCurrency === "KRW") {
    return amount;
  }

  const rates = await getExchangeRates();
  const rate = rates[fromCurrency.toUpperCase()];

  if (!rate) {
    console.warn(`Unknown currency: ${fromCurrency}, returning original amount`);
    return amount;
  }

  // fromCurrency를 KRW로 변환
  // 예: 100 USD * (1 / 0.00075) = 133,333 KRW
  return amount / rate;
}

// KRW를 다른 통화로 변환
export async function convertFromKRW(
  amount: number,
  toCurrency: string
): Promise<number> {
  if (toCurrency === "KRW") {
    return amount;
  }

  const rates = await getExchangeRates();
  const rate = rates[toCurrency.toUpperCase()];

  if (!rate) {
    console.warn(`Unknown currency: ${toCurrency}, returning original amount`);
    return amount;
  }

  // KRW를 toCurrency로 변환
  return amount * rate;
}

// 통화 기호 반환
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    KRW: "₩",
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
  };

  return symbols[currency.toUpperCase()] || currency;
}

// 가격 포맷팅
export function formatPrice(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  
  if (currency === "KRW" || currency === "JPY") {
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  } else {
    return `${symbol}${amount.toFixed(2)}`;
  }
}



