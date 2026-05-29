/**
 * §11.308e #smart-receiving-status-card — Regression sentinel
 *
 * 호영님 P2 옵션 B (경량 — 새 API 0):
 *   §11.308a-v2 가 스마트 입고 진입을 글로벌 Header(ScanLine button)로 승격한 뒤,
 *   대시보드 본문에 awareness + status 카드를 신설.
 *
 * canonical truth 가드:
 *   - 카드 = display-only (pending count 만 표시). 스캔 진입 button 신설 0
 *     (Header 단일 source 보존, 중복 진입 방지).
 *   - CTA = 입고 큐(/dashboard/purchase-orders?bucket=handoff) real route — dead button 0.
 *   - count source = stats.compareStats.purchaseToReceivingCount (mutation 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const CARD_PATH = "src/components/dashboard/SmartReceivingStatusCard.tsx";
const PAGE_PATH = "src/app/dashboard/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.308e — SmartReceivingStatusCard 컴포넌트 (옵션 B 경량)", () => {
  it("컴포넌트 + props + testid 정합", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/export function SmartReceivingStatusCard/);
    expect(src).toMatch(/pendingHandoffCount:\s*number/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-status-card"/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-pending-badge"/);
    expect(src).toMatch(/data-testid="dashboard-smart-receiving-status-cta"/);
  });

  it("처리 대기 badge 분기 — 1+건 yellow / 0건 emerald (§11.302 신호등)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
    expect(src).toMatch(/bg-emerald-50 text-emerald-700/);
    expect(src).toMatch(/처리 대기/);
  });

  it("Header [스마트 입고] 진입을 본문에서 awareness — 안내 문구", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/상단 헤더/);
    expect(src).toMatch(/\[스마트 입고\]/);
    expect(src).toMatch(/AI .*OCR .*재고에 자동 반영/);
  });

  it("단일 CTA = 입고 큐 (real route, 항상 활성, dead button 0)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/href="\/dashboard\/purchase-orders\?bucket=handoff"/);
    expect(src).toMatch(/입고 큐 열기/);
  });

  it("canonical truth — 카드 안 스캐너 modal/스캔 button 신설 0 (Header 단일 source)", () => {
    const src = read(CARD_PATH);
    expect(src).not.toMatch(/SmartReceivingScannerModal/);
    expect(src).not.toMatch(/SmartReceivingPlaceholderModal/);
    expect(src).not.toMatch(/setIs.*Open\(true\)/);
    // 새 API 호출 0 (옵션 B 경량 — 기존 stats forward 만)
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/useSWR|useQuery|useEffect/);
  });

  it("amber/orange Tailwind class 0 (§11.302d-6 정합)", () => {
    const src = read(CARD_PATH);
    expect(src).not.toMatch(/(bg|text|border|border-l|from|to|ring|fill|stroke)-(amber|orange)-[0-9]/);
  });

  it("ScanLine 아이콘 + emerald accent (Header 톤 정합)", () => {
    const src = read(CARD_PATH);
    expect(src).toMatch(/import .*ScanLine.* from "lucide-react"/);
    expect(src).toMatch(/<ScanLine className=/);
    expect(src).toMatch(/bg-emerald-50/);
    expect(src).toMatch(/text-emerald-600/);
  });
});

describe("§11.308e — dashboard/page.tsx wiring (OperatorQuickActions 직후)", () => {
  it("SmartReceivingStatusCard import + 정확 위치 wiring", () => {
    const src = read(PAGE_PATH);
    expect(src).toMatch(/import \{ SmartReceivingStatusCard \} from "@\/components\/dashboard\/SmartReceivingStatusCard"/);
    // OperatorQuickActions 직후 wiring (count forward — canonical truth display-only)
    expect(src).toMatch(/<OperatorQuickActions[\s\S]{0,800}<SmartReceivingStatusCard/);
    expect(src).toMatch(/pendingHandoffCount=\{stats\.compareStats\.purchaseToReceivingCount\}/);
  });
});
