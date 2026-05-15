/**
 * §11.246e-cont #lighthouse-ci-automation — 호영님 §11.246e baseline 자연 후속.
 *
 * 호영님 spec: GitHub Actions 안 @lhci/cli 추가 + Core Web Vitals (LCP/CLS/INP)
 *   budget 강제. §11.246e baseline (PageSpeed Insights API 일회성 측정) →
 *   continuous CI 자동화. PR 마다 회귀 차단.
 *
 * Strategy:
 *   - .lighthouserc.json — collect (3 public URL + numberOfRuns 3) + assert
 *     (Core Web Vitals budget + Performance score).
 *   - .github/workflows/lighthouse-ci.yml — pull_request + push 트리거 +
 *     Node 20 LTS + npx @lhci/cli autorun.
 *
 * canonical truth lock:
 *   - 기존 5 workflow (check-deleted-files / db-drift-detector / labaxis-agent-board /
 *     labaxis-agent-board-preflight-only / labaxis-surface-guard) 보존.
 *   - public URL 만 측정 (/, /pricing, /login) — auth 필요 dashboard 제외.
 *   - production URL = https://labaxis.co.kr (§11.246e baseline 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const LHCI_CONFIG_PATH = resolve(REPO_ROOT, ".lighthouserc.json");
const WORKFLOW_PATH = resolve(REPO_ROOT, ".github/workflows/lighthouse-ci.yml");

const lhciExists = existsSync(LHCI_CONFIG_PATH);
const workflowExists = existsSync(WORKFLOW_PATH);

const lhci = lhciExists ? readFileSync(LHCI_CONFIG_PATH, "utf8") : "";
const workflow = workflowExists ? readFileSync(WORKFLOW_PATH, "utf8") : "";

describe("§11.246e-cont #1 — .lighthouserc.json 존재 + ci structure", () => {
  it(".lighthouserc.json 파일 존재", () => {
    expect(lhciExists).toBe(true);
  });

  it("ci.collect 섹션 존재", () => {
    expect(lhci).toMatch(/"ci"[\s\S]*?"collect"/);
  });

  it("ci.assert 섹션 존재", () => {
    expect(lhci).toMatch(/"ci"[\s\S]*?"assert"/);
  });

  it("collect.url 안 production URL https://labaxis.co.kr 포함", () => {
    expect(lhci).toMatch(/https:\/\/labaxis\.co\.kr/);
  });

  it("collect.numberOfRuns >= 3 (variance 감소)", () => {
    expect(lhci).toMatch(/"numberOfRuns"\s*:\s*[3-9]/);
  });
});

describe("§11.246e-cont #2 — assertions (Core Web Vitals budget)", () => {
  it("largest-contentful-paint assertion (LCP)", () => {
    expect(lhci).toMatch(/"largest-contentful-paint"/);
  });

  it("cumulative-layout-shift assertion (CLS)", () => {
    expect(lhci).toMatch(/"cumulative-layout-shift"/);
  });

  it("interaction-to-next-paint 또는 max-potential-fid assertion (INP/FID)", () => {
    expect(lhci).toMatch(/"interaction-to-next-paint"|"max-potential-fid"|"interactive"/);
  });

  it("categories:performance assertion (전체 Performance score)", () => {
    expect(lhci).toMatch(/"categories:performance"/);
  });

  it("assertion level warn 또는 error (강제 budget)", () => {
    expect(lhci).toMatch(/"warn"|"error"/);
  });
});

describe("§11.246e-cont #3 — .github/workflows/lighthouse-ci.yml 존재 + structure", () => {
  it("workflow 파일 존재", () => {
    expect(workflowExists).toBe(true);
  });

  it("name 'Lighthouse CI' 또는 LHCI", () => {
    expect(workflow).toMatch(/name:\s*(Lighthouse CI|LHCI|lighthouse-ci)/i);
  });

  it("pull_request + push 트리거", () => {
    expect(workflow).toMatch(/pull_request/);
    expect(workflow).toMatch(/push/);
  });

  it("actions/checkout@v4 사용 (기존 workflow 패턴 reuse)", () => {
    expect(workflow).toMatch(/actions\/checkout@v4/);
  });

  it("Node 20 setup (actions/setup-node)", () => {
    expect(workflow).toMatch(/actions\/setup-node/);
    expect(workflow).toMatch(/node-version:\s*['"]?20/);
  });

  it("@lhci/cli npx 또는 install 후 실행", () => {
    expect(workflow).toMatch(/@lhci\/cli/);
  });

  it("lhci autorun 또는 lhci collect/assert 호출", () => {
    expect(workflow).toMatch(/lhci\s+(autorun|collect|assert)/);
  });
});

describe("§11.246e-cont #4 — invariant 보존 (기존 workflow)", () => {
  it("§11.246d-3 observeLCP helper 보존", () => {
    const helper = readFileSync(
      resolve(__dirname, "../../lib/performance/lcp-observer.ts"),
      "utf8",
    );
    expect(helper).toMatch(/export\s+function\s+observeLCP/);
  });

  it("§11.246d-4-cont RumMetric model 보존 (사전 cluster)", () => {
    const schema = readFileSync(
      resolve(__dirname, "../../../prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).toMatch(/model\s+RumMetric\s*\{/);
  });

  it("기존 surface-guard workflow 보존 (sentinel: 'Surface Guard' name)", () => {
    const surfaceGuard = readFileSync(
      resolve(REPO_ROOT, ".github/workflows/labaxis-surface-guard.yml"),
      "utf8",
    );
    expect(surfaceGuard).toMatch(/name:\s*LabAxis Surface Guard/);
  });

  it("§11.246e-cont trace marker comment (lhci config 또는 workflow)", () => {
    const combined = lhci + "\n" + workflow;
    expect(combined).toMatch(/§11\.246e-cont|11\.246e-cont/);
  });
});
