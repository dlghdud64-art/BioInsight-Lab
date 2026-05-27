/**
 * Currency 포맷팅 유틸리티
 * WO 오류 방지 및 null/undefined 처리
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "KRW"
): string {
  // null, undefined, NaN 처리
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "0원";
  }

  const safeAmount = Number(amount);
  if (isNaN(safeAmount) || safeAmount < 0) {
    return "0원";
  }

  if (currency === "KRW") {
    return `₩${safeAmount.toLocaleString("ko-KR")}`;
  }

  // 다른 통화의 경우
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: currency,
    }).format(safeAmount);
  } catch (error) {
    // 통화 코드가 유효하지 않은 경우
    return `${currency} ${safeAmount.toLocaleString("ko-KR")}`;
  }
}

/**
 * Date 포맷팅 유틸리티
 * Invalid Date 오류 방지
 */
export function formatDate(
  date: Date | string | null | undefined,
  options?: {
    format?: "short" | "long" | "datetime" | "date";
    locale?: string;
  }
): string {
  // null, undefined 처리
  if (!date) {
    return "-";
  }

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Invalid Date 체크
    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    const format = options?.format || "short";
    const locale = options?.locale || "ko-KR";

    switch (format) {
      case "long":
        return dateObj.toLocaleDateString(locale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      case "datetime":
        return dateObj.toLocaleString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      case "date":
        return dateObj.toLocaleDateString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      default: // short
        return dateObj.toLocaleDateString(locale);
    }
  } catch (error) {
    // 파싱 실패 시
    return "-";
  }
}

/**
 * 상대 시간 포맷팅 (예: "3일 전", "2시간 전")
 */
export function formatRelativeTime(
  date: Date | string | null | undefined
): string {
  if (!date) {
    return "-";
  }

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return "방금 전";
    } else if (diffMin < 60) {
      return `${diffMin}분 전`;
    } else if (diffHour < 24) {
      return `${diffHour}시간 전`;
    } else if (diffDay < 30) {
      return `${diffDay}일 전`;
    } else {
      return formatDate(dateObj, { format: "short" });
    }
  } catch (error) {
    return "-";
  }
}

