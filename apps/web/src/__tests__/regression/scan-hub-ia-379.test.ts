/**
 * §11.379 (회귀 보호) — 스캔 IA 입고/사용 2분류.
 *
 * ScanHubContent 평면 3나열(라벨·명세서·QR) → 재고 흐름 방향 2그룹:
 *   입고 스캔(재고+): 라벨 직접등록 + 거래명세서 입고.
 *   재고 사용(재고−): QR 차감(조회 후 수량 확인→차감 확정).
 * QR 라벨 "재고조회" → "재고 사용"으로 정비(실제 차감 동작 반영).
 *
 * sentinel(readFileSync+regex). openModal type / testid 보존(회귀 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const HUB = "src/components/inventory/ScanHubModal.tsx";

describe("§11.379 — 입고/사용 2그룹", () => {
  it("입고 스캔 / 재고 사용 섹션 헤더", () => {
    const src = read(HUB);
    expect(src).toMatch(/section: "입고 스캔"/);
    expect(src).toMatch(/section: "재고 사용"/);
    expect(src).toMatch(/SCAN_GROUPS/);
  });

  it("입고 그룹 = 라벨+명세서, 사용 그룹 = QR", () => {
    const src = read(HUB);
    // 입고 섹션 블록에 label_scanner·smart_receiving
    const inbound = src.slice(src.indexOf('section: "입고 스캔"'), src.indexOf('section: "재고 사용"'));
    expect(inbound).toMatch(/type: "label_scanner"/);
    expect(inbound).toMatch(/type: "smart_receiving"/);
    // 사용 섹션 블록에 qr_scanner
    const usage = src.slice(src.indexOf('section: "재고 사용"'));
    expect(usage).toMatch(/type: "qr_scanner"/);
  });

  it("QR 라벨이 '재고 사용'(차감)으로 정비", () => {
    const src = read(HUB);
    expect(src).toMatch(/title: "QR 재고 사용"/);
    expect(src).toMatch(/사용량을 차감/);
  });
});

describe("§11.379 — 회귀 0", () => {
  it("openModal type wiring + scan-hub testid 보존", () => {
    const src = read(HUB);
    expect(src).toMatch(/onClick=\{\(\) => openModal\(o\.type\)\}/);
    expect(src).toMatch(/data-testid="scan-hub"/);
    expect(src).toMatch(/data-testid=\{`scan-hub-\$\{o\.type\}`\}/);
  });
});
