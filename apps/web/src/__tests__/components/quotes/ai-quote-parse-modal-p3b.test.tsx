import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiQuoteParseModal } from "@/components/quotes/ai-quote-parse-modal";

// §catalog-A P4 — 모달 등록 wiring 런타임 검증(RTL, 결정적). e2e smoke 대체.
//   핵심: ① 봉합(빈 quoteItemId 미전송) + exact 자동 + candidate picker 선택 + none 제외/가드.
//   csrfFetch 를 URL 별 mock → handleRegister payload(body) 를 직접 단언.

let parsedDoc: any;
let matchResults: any;
const vendorRepliesBodies: any[] = [];

vi.mock("@/lib/api-client", () => ({
  csrfFetch: vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/parse-pdf") || url.includes("/parse-image")) {
      return { ok: true, json: async () => ({ parsed: parsedDoc, confidence: "high", itemCount: parsedDoc.items.length }) };
    }
    if (url.includes("/match-products")) {
      return { ok: true, json: async () => ({ results: matchResults }) };
    }
    if (url.includes("/vendor-replies")) {
      vendorRepliesBodies.push(JSON.parse((init?.body as string) ?? "{}"));
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: false, json: async () => ({ error: "unexpected url" }) };
  }),
}));

async function uploadPdfAndReachReview(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["dummy-pdf"], "quote.pdf", { type: "application/pdf" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, file);
  await waitFor(() => expect(screen.getByText(/품목 상세/)).toBeTruthy());
}

beforeEach(() => {
  vendorRepliesBodies.length = 0;
  parsedDoc = {
    vendor: { name: "테스트 공급사" },
    currency: "KRW",
    totalAmount: 15000,
    items: [
      { productName: "PBS pH7.4", catalogNumber: "P3813", specification: null, unitPrice: 10000, leadTimeDays: 3, notes: null },
      { productName: "정체불명 시약", catalogNumber: "ZZZ999", specification: null, unitPrice: 5000, leadTimeDays: null, notes: null },
    ],
  };
});

describe("§catalog-A P4 — exact 자동: 빈 quoteItemId 미전송(① 봉합)", () => {
  it("exact 라인은 자동 quoteItemId, none 라인은 제외하여 등록", async () => {
    matchResults = [
      { lineIndex: 0, tier: "exact", matches: [{ quoteItemId: "qli_exact_1", name: "PBS", catalogNumber: "P3813" }] },
      { lineIndex: 1, tier: "none", matches: [] },
    ];
    const user = userEvent.setup();
    render(<AiQuoteParseModal open quoteId="quote_1" onClose={() => {}} />);
    await uploadPdfAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /벤더 응답으로 등록/ }));
    await waitFor(() => expect(vendorRepliesBodies.length).toBe(1));

    const body = vendorRepliesBodies[0];
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quoteItemId).toBe("qli_exact_1");
    expect(body.items.some((x: any) => x.quoteItemId === "")).toBe(false);
  });
});

describe("§catalog-A P4 — candidate picker: 선택값이 payload 에 실림", () => {
  it("candidate 배지 클릭 → Sheet 후보 선택 → 선택 quoteItemId 등록", async () => {
    matchResults = [
      { lineIndex: 0, tier: "candidate", matches: [
        { quoteItemId: "qli_a", name: "PBS · Sigma", catalogNumber: "P3813" },
        { quoteItemId: "qli_b", name: "PBS · Capricorn", catalogNumber: "PBS-3" },
      ] },
      { lineIndex: 1, tier: "none", matches: [] },
    ];
    const user = userEvent.setup();
    render(<AiQuoteParseModal open quoteId="quote_1" onClose={() => {}} />);
    await uploadPdfAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /후보 2/ }));
    await waitFor(() => expect(screen.getByText(/매칭할 견적 품목 선택/)).toBeTruthy());
    await user.click(screen.getByText(/Capricorn/));

    await user.click(screen.getByRole("button", { name: /벤더 응답으로 등록/ }));
    await waitFor(() => expect(vendorRepliesBodies.length).toBe(1));

    const body = vendorRepliesBodies[0];
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quoteItemId).toBe("qli_b");
  });
});

describe("§catalog-A P4 — none-only: 등록 차단(빈 items 400 방지)", () => {
  it("매칭 0건이면 vendor-replies 미호출 + 에러 안내", async () => {
    matchResults = [
      { lineIndex: 0, tier: "none", matches: [] },
      { lineIndex: 1, tier: "none", matches: [] },
    ];
    const user = userEvent.setup();
    render(<AiQuoteParseModal open quoteId="quote_1" onClose={() => {}} />);
    await uploadPdfAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /벤더 응답으로 등록/ }));
    await waitFor(() => expect(screen.getByText(/매칭된 품목이 없습니다/)).toBeTruthy());
    expect(vendorRepliesBodies.length).toBe(0);
  });
});
