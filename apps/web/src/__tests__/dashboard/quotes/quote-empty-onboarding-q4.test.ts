/**
 * §quote-flat Q4 — 빈 상태 온보딩(시안 §01·§11)
 *
 * queue-empty(케이스 0건·필터 미적용) = 3단계 안내(생성→발송→비교·발주) + 두 CTA.
 *   - 견적 케이스 만들기 → /app/search(신규 RFQ, Link). 견적서 스캔으로 시작 → setAiParseModalOpen(헤더 스캔 동일 wiring).
 *   - dead button 0(두 CTA 실배선). compact(큰 일러스트·장문 금지). §11.302 amber/orange 0.
 *
 * 회귀 0 lock: filter-empty 분기(필터 적용 시) 보존 — queue-empty 만 온보딩으로 강화.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-flat Q4 — 빈 상태 온보딩(3단계)", () => {
  it("3단계 안내 라벨", () => {
    expect(page).toMatch(/견적 케이스 생성/);
    expect(page).toMatch(/공급사에 발송/);
    expect(page).toMatch(/회신 비교·발주/);
  });
  it("CTA '견적 케이스 만들기' → /app/search Link(실배선)", () => {
    expect(page).toMatch(/href="\/app\/search"[\s\S]{0,300}견적 케이스 만들기/);
  });
  it("CTA '견적서 스캔으로 시작' → handleScanOpen(real, dead button 0)", () => {
    // §quote-perm-gate(§10): 스캔 진입이 inline setAiParseModalOpen → handleScanOpen(perm 사전체크 후 모달)로
    //   리팩터. CTA 식별자만 갱신, real/dead-button-0 의도는 불변 — 핸들러가 실제 모달을 여는지 함께 검증.
    expect(page).toMatch(/onClick=\{handleScanOpen\}[\s\S]{0,200}견적서 스캔으로 시작/);
    expect(page).toMatch(/const handleScanOpen = useCallback\([\s\S]{0,200}setAiParseModalOpen\(true\)/);
  });
  it("§11.302 — 온보딩 amber/orange 0", () => {
    const start = page.indexOf("§quote-flat Q4 — 빈 상태 온보딩");
    const block = page.slice(start, start + 2200);
    expect(block).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§quote-flat Q4 — 회귀 0(filter-empty 분기 보존)", () => {
  it("filter-empty 분기(필터 적용 시) 보존", () => {
    expect(page).toMatch(/현재 조건에 맞는 견적 케이스가 없습니다/);
    expect(page).toMatch(/필터 초기화/);
  });
  it("queue vs filter empty 분기 조건 보존", () => {
    expect(page).toMatch(/searchQuery \|\| statusFilter !== "all" \|\| modeChip/);
  });
});
