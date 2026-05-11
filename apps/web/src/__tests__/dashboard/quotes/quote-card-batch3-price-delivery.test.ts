/**
 * #quote-card-batch3-price-delivery — 호영님 Batch III #4
 *
 * 호영님 spec:
 *   - 수신 상태: "₩{min} ~ ₩{max} ({n}건 수신)" — 가격 범위 + 회신 수
 *   - 미수신 상태: "견적 미수신" 회색 텍스트
 *   - 납기 정보: "납기 X일 남음" / "오늘 마감" / "Y일 지연" 상대 표현
 *
 * canonical truth lock:
 *   - quote.responses[].totalPrice / quote.deliveryDate / quote.createdAt 변경 0
 *   - 기존 Package itemCount + RelativeTimeText createdAt 보존
 *   - §11.217 + §11.218 + §11.221 + §11.222 cluster invariant 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const HELPER_PATH = resolve(__dirname, "../../../components/quotes/relative-delivery-text.tsx");
const page = readFileSync(PAGE_PATH, "utf8");
const helper = readFileSync(HELPER_PATH, "utf8");

describe("#quote-card-batch3-price-delivery — RelativeDeliveryText helper", () => {
  it("RelativeDeliveryText helper 존재 (use client + useEffect 패턴)", () => {
    expect(helper).toMatch(/"use client"/);
    expect(helper).toMatch(/export function RelativeDeliveryText/);
    expect(helper).toMatch(/useEffect/);
  });

  it("상대 일수 분기 (지연 / 오늘 마감 / 남음)", () => {
    expect(helper).toMatch(/일 지연/);
    expect(helper).toMatch(/오늘 마감/);
    expect(helper).toMatch(/일 남음/);
  });

  it("§11.212 mirror — useEffect mount 후 set (SSR drift 차단)", () => {
    expect(helper).toMatch(/useState[\s\S]{0,80}—/);
    expect(helper).toMatch(/Date\.now\(\)/);
  });
});

describe("#quote-card-batch3-price-delivery — 가격 범위 + 회신 수 통합", () => {
  it("maxPrice 변수 추가 (range 계산)", () => {
    expect(page).toMatch(/const maxPrice = prices\.length \? Math\.max/);
  });

  it("미수신 상태 — '견적 미수신' 명시", () => {
    expect(page).toMatch(/responseCount === 0[\s\S]{0,300}견적 미수신/);
  });

  it("수신 + 가격 범위 — min === max 시 단일, 다르면 range", () => {
    expect(page).toMatch(/minPrice === maxPrice/);
    expect(page).toMatch(/건 수신/);
  });

  it("가격 미기재 edge case — '회신 N건 (가격 미기재)'", () => {
    expect(page).toMatch(/prices\.length === 0[\s\S]{0,200}가격 미기재/);
  });
});

describe("#quote-card-batch3-price-delivery — 납기 상대 일수", () => {
  it("page.tsx 가 RelativeDeliveryText import + 사용", () => {
    expect(page).toMatch(/import \{ RelativeDeliveryText \} from "@\/components\/quotes\/relative-delivery-text"/);
    expect(page).toMatch(/<RelativeDeliveryText/);
  });

  it("기존 절대 날짜 (toLocaleDateString) 패턴 잔존하지 않음 — 납기 영역", () => {
    expect(page).not.toMatch(/<Clock className="h-3 w-3" \/>납기 \{new Date\(quote\.deliveryDate\)\.toLocaleDateString/);
  });
});

describe("#quote-card-batch3-price-delivery — invariant 보존", () => {
  it("§11.218 user/org line 보존", () => {
    expect(page).toMatch(/quote\.user\?\.name/);
  });

  it("§11.221 긴급도 뱃지 (delayed && bg-rose-500) 보존", () => {
    expect(page).toMatch(/delayed[\s\S]{0,300}bg-rose-500[\s\S]{0,80}긴급/);
  });

  it("§11.217 itemCount + RelativeTimeText createdAt 보존", () => {
    expect(page).toMatch(/itemCount}건/);
    expect(page).toMatch(/RelativeTimeText iso=\{quote\.createdAt\}/);
  });

  it("cluster trace marker (§11.223)", () => {
    expect(page).toMatch(/#quote-card-batch3-price-delivery|§11\.223|가격 범위/);
  });
});
