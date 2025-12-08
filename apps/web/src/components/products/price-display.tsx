"use client";

import { Badge } from "@/components/ui/badge";
import { formatPrice, getCurrencySymbol } from "@/lib/api/exchange-rate";

interface PriceDisplayProps {
  price?: number;
  currency?: string;
  priceInKRW?: number;
  showOriginal?: boolean; // 원래 통화 가격도 표시할지 여부
}

export function PriceDisplay({
  price,
  currency = "KRW",
  priceInKRW,
  showOriginal = true,
}: PriceDisplayProps) {
  if (!price && !priceInKRW) {
    return <span className="text-muted-foreground">가격 문의</span>;
  }

  const displayPrice = priceInKRW || price || 0;
  const displayCurrency = priceInKRW ? "KRW" : currency;

  // 원래 통화와 KRW가 다른 경우 둘 다 표시
  if (showOriginal && price && currency !== "KRW" && priceInKRW) {
    return (
      <div className="space-y-1">
        <div className="font-semibold text-lg">
          ₩{Math.round(priceInKRW).toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatPrice(price, currency)} (원가)
        </div>
      </div>
    );
  }

  return (
    <div className="font-semibold">
      {formatPrice(displayPrice, displayCurrency)}
      {currency !== "KRW" && priceInKRW && (
        <Badge variant="outline" className="ml-2 text-xs">
          환율 적용
        </Badge>
      )}
    </div>
  );
}




import { Badge } from "@/components/ui/badge";
import { formatPrice, getCurrencySymbol } from "@/lib/api/exchange-rate";

interface PriceDisplayProps {
  price?: number;
  currency?: string;
  priceInKRW?: number;
  showOriginal?: boolean; // 원래 통화 가격도 표시할지 여부
}

export function PriceDisplay({
  price,
  currency = "KRW",
  priceInKRW,
  showOriginal = true,
}: PriceDisplayProps) {
  if (!price && !priceInKRW) {
    return <span className="text-muted-foreground">가격 문의</span>;
  }

  const displayPrice = priceInKRW || price || 0;
  const displayCurrency = priceInKRW ? "KRW" : currency;

  // 원래 통화와 KRW가 다른 경우 둘 다 표시
  if (showOriginal && price && currency !== "KRW" && priceInKRW) {
    return (
      <div className="space-y-1">
        <div className="font-semibold text-lg">
          ₩{Math.round(priceInKRW).toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatPrice(price, currency)} (원가)
        </div>
      </div>
    );
  }

  return (
    <div className="font-semibold">
      {formatPrice(displayPrice, displayCurrency)}
      {currency !== "KRW" && priceInKRW && (
        <Badge variant="outline" className="ml-2 text-xs">
          환율 적용
        </Badge>
      )}
    </div>
  );
}




import { Badge } from "@/components/ui/badge";
import { formatPrice, getCurrencySymbol } from "@/lib/api/exchange-rate";

interface PriceDisplayProps {
  price?: number;
  currency?: string;
  priceInKRW?: number;
  showOriginal?: boolean; // 원래 통화 가격도 표시할지 여부
}

export function PriceDisplay({
  price,
  currency = "KRW",
  priceInKRW,
  showOriginal = true,
}: PriceDisplayProps) {
  if (!price && !priceInKRW) {
    return <span className="text-muted-foreground">가격 문의</span>;
  }

  const displayPrice = priceInKRW || price || 0;
  const displayCurrency = priceInKRW ? "KRW" : currency;

  // 원래 통화와 KRW가 다른 경우 둘 다 표시
  if (showOriginal && price && currency !== "KRW" && priceInKRW) {
    return (
      <div className="space-y-1">
        <div className="font-semibold text-lg">
          ₩{Math.round(priceInKRW).toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatPrice(price, currency)} (원가)
        </div>
      </div>
    );
  }

  return (
    <div className="font-semibold">
      {formatPrice(displayPrice, displayCurrency)}
      {currency !== "KRW" && priceInKRW && (
        <Badge variant="outline" className="ml-2 text-xs">
          환율 적용
        </Badge>
      )}
    </div>
  );
}





