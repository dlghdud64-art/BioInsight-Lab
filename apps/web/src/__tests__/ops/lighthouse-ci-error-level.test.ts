/**
 * §11.246e-cont-2 #lighthouse-ci-error-level — 호영님 §11.246e-cont 자연 후속.
 *
 * 호영님 spec: warn → error 전환 (baseline 안정화 후). scope 결정 "권장은? = 핵심
 *   Core Web Vitals (LCP/CLS/INP) 만 error, 나머지 warn 유지".
 *
 * Strategy:
 *   - largest-contentful-paint / cumulative-layout-shift /
 *     interaction-to-next-paint 3 budget → assertion level "error".
 *   - 나머지 8 budget (categories 4 + max-potential-fid + interactive +
 *     speed-index + total-blocking-time) → "warn" 유지.
 *   - PR 회귀 시 LCP/CLS/INP 만 block — false positive ↓ + 핵심 신호 강화.
 *
 * canonical truth lock:
 *   - §11.246e-cont .lighthouserc.json 구조 보존 (ci.collect + ci.assert + upload).
 *   - 3 URL + numberOfRuns 3 + desktop preset 보존.
 *   - 11 budget 모두 존재 (값/threshold 변경 0, level 만 swap).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const LHCI_CONFIG_PATH = resolve(REPO_ROOT, ".lighthouserc.json");

const lhci = existsSync(LHCI_CONFIG_PATH)
  ? readFileSync(LHCI_CONFIG_PATH, "utf8")
  : "";

describe("§11.246e-cont-2 #1 — Core Web Vitals error level (LCP/CLS/INP)", () => {
  it("largest-contentful-paint error level", () => {
    expect(lhci).toMatch(/"largest-contentful-paint"[\s\S]{0,200}"error"/);
  });

  it("cumulative-layout-shift error level", () => {
    expect(lhci).toMatch(/"cumulative-layout-shift"[\s\S]{0,200}"error"/);
  });

  it("interaction-to-next-paint error level", () => {
    expect(lhci).toMatch(/"interaction-to-next-paint"[\s\S]{0,200}"error"/);
  });
});

describe("§11.246e-cont-2 #2 — 나머지 budget warn 유지", () => {
  it("categories:performance warn (overall score)", () => {
    expect(lhci).toMatch(/"categories:performance"[\s\S]{0,200}"warn"/);
  });

  it("max-potential-fid warn (legacy)", () => {
    expect(lhci).toMatch(/"max-potential-fid"[\s\S]{0,200}"warn"/);
  });

  it("interactive warn (secondary)", () => {
    expect(lhci).toMatch(/"interactive"[\s\S]{0,200}"warn"/);
  });

  it("speed-index warn (secondary)", () => {
    expect(lhci).toMatch(/"speed-index"[\s\S]{0,200}"warn"/);
  });

  it("total-blocking-time warn (secondary)", () => {
    expect(lhci).toMatch(/"total-blocking-time"[\s\S]{0,200}"warn"/);
  });
});

describe("§11.246e-cont-2 #3 — invariant 보존 (§11.246e-cont 구조)", () => {
  it("ci.collect.url 3 public URL 보존", () => {
    expect(lhci).toMatch(/https:\/\/labaxis\.co\.kr/);
    expect(lhci).toMatch(/\/pricing/);
    expect(lhci).toMatch(/\/login/);
  });

  it("numberOfRuns 3 보존", () => {
    expect(lhci).toMatch(/"numberOfRuns"\s*:\s*3/);
  });

  it("desktop preset 보존", () => {
    expect(lhci).toMatch(/"preset"\s*:\s*"desktop"/);
  });

  it("upload temporary-public-storage 보존", () => {
    expect(lhci).toMatch(/"target"\s*:\s*"temporary-public-storage"/);
  });

  it("ci.assert.assertions 11 budget 모두 존재 (값 변경 0)", () => {
    expect(lhci).toMatch(/"largest-contentful-paint"/);
    expect(lhci).toMatch(/"cumulative-layout-shift"/);
    expect(lhci).toMatch(/"interaction-to-next-paint"/);
    expect(lhci).toMatch(/"max-potential-fid"/);
    expect(lhci).toMatch(/"interactive"/);
    expect(lhci).toMatch(/"speed-index"/);
    expect(lhci).toMatch(/"total-blocking-time"/);
    expect(lhci).toMatch(/"categories:performance"/);
    expect(lhci).toMatch(/"categories:accessibility"/);
    expect(lhci).toMatch(/"categories:best-practices"/);
    expect(lhci).toMatch(/"categories:seo"/);
  });

  it("§11.246e-cont-2 trace marker comment", () => {
    expect(lhci).toMatch(/§11\.246e-cont-2|11\.246e-cont-2/);
  });
});

describe("§11.246e-cont-3 #4 — 운영 경로별 실패 기준 한국어 근거", () => {
  it("랜딩, 요금, 로그인 3개 경로에 LCP/CLS/INP 실패 수치를 직접 명시한다", () => {
    for (const routeLabel of ["랜딩 /", "요금 /pricing", "로그인 /login"]) {
      expect(lhci).toMatch(new RegExp(`${routeLabel}[\\s\\S]{0,160}LCP>2500ms`));
      expect(lhci).toMatch(new RegExp(`${routeLabel}[\\s\\S]{0,160}CLS>0\\.1`));
      expect(lhci).toMatch(new RegExp(`${routeLabel}[\\s\\S]{0,160}INP>200ms`));
    }
  });

  it("Lighthouse 실패 경고와 2회 연속 재현 시 release hold 판독 기준을 노출한다", () => {
    expect(lhci).toMatch(/Core Web Vitals error/);
    expect(lhci).toMatch(/2회 연속/);
    expect(lhci).toMatch(/release hold/);
  });
});
