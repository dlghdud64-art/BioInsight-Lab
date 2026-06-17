/**
 * §scan-hub-color — 스캔 허브 "의도를 색으로 분리"(스캔 허브 구현 지시문)
 *
 * 입고=green(ok #1b9e5a / weak #e6f5ec), 사용=amber(warn #d8870b / weak #fbf0db).
 *   그룹색을 방향 배지·아이콘 칩·hover 테두리·화살표에 일괄 적용.
 * amber는 본 surface 의도색으로 호영님 룰링(가) — §11.302 supersede(스캔허브 한정).
 *
 * 회귀 0: 구조/라우팅/testid/라벨(scan-hub-ia-379 잠금) 전부 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(__dirname, "..", "..", "components/inventory/ScanHubModal.tsx"),
  "utf8",
);

describe("§scan-hub-color — 의도별 색 토큰", () => {
  it("입고=ok(green) / 사용=warn(amber) 팔레트(지시문 정본)", () => {
    expect(SRC).toMatch(/ink:\s*"#1b9e5a"/); // ok 입고
    expect(SRC).toMatch(/weak:\s*"#e6f5ec"/);
    expect(SRC).toMatch(/ink:\s*"#d8870b"/); // warn 사용
    expect(SRC).toMatch(/weak:\s*"#fbf0db"/);
  });
  it("그룹별 tone(in/use) + 방향 배지(증가/차감)", () => {
    expect(SRC).toMatch(/tone:\s*"in" as const/);
    expect(SRC).toMatch(/tone:\s*"use" as const/);
    expect(SRC).toMatch(/dir:\s*"증가"/);
    expect(SRC).toMatch(/dir:\s*"차감"/);
  });
  it("색 적용 위치 — 아이콘칩(weak 배경+ink) + hover 테두리 + 화살표 hover", () => {
    expect(SRC).toMatch(/style=\{\{ background: t\.weak \}\}/);
    expect(SRC).toMatch(/style=\{\{ color: t\.ink \}\}/);
    expect(SRC).toMatch(/hover:border-\[#9fd6ba\]/); // 입고 hover
    expect(SRC).toMatch(/hover:border-\[#edc991\]/); // 사용 hover
    expect(SRC).toMatch(/group-hover:text-\[#1b9e5a\]/);
    expect(SRC).toMatch(/group-hover:text-\[#d8870b\]/);
  });
});

describe("§scan-hub-color — 회귀 0(구조·라우팅·testid 보존)", () => {
  it("SCAN_GROUPS 2섹션 + 3 type + openModal wiring + testid", () => {
    expect(SRC).toMatch(/section: "입고 스캔"/);
    expect(SRC).toMatch(/section: "재고 사용"/);
    expect(SRC).toMatch(/type: "label_scanner"/);
    expect(SRC).toMatch(/type: "smart_receiving"/);
    expect(SRC).toMatch(/type: "qr_scanner"/);
    expect(SRC).toMatch(/title: "QR 재고 사용"/);
    expect(SRC).toMatch(/onClick=\{\(\) => openModal\(o\.type\)\}/);
    expect(SRC).toMatch(/data-testid="scan-hub"/);
    expect(SRC).toMatch(/data-testid=\{`scan-hub-\$\{o\.type\}`\}/);
  });
  it("dead button 0 — 토스트-only 미도입(실 모달 라우팅 유지)", () => {
    expect(SRC).not.toMatch(/onAct|toast\(/);
  });
});
