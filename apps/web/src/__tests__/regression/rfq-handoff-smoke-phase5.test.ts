/**
 * §11.305-phase5 #rfq-handoff-smoke — RFQ handoff smoke (sourcing-d2-d3-wiring)
 *   구조 정합 lock sentinel. release-prep P1 Phase 5.
 *
 * Phase 0 evidence:
 *   sourcing-d2-d3-wiring.test.ts (9 it × 2 describe) 가 D-2/D-3 핵심
 *   workflow handoff 의 canonical truth + governance domain 정합을
 *   모두 covering. 이를 release-prep P1 의 RFQ smoke path 로 채택.
 *
 * D-2 (adaptComparisonHandoffToRequestSeed) — 4 it:
 *   1. synthesize request handoff with one product id matching synthetic product
 *   2. recommended vendor first in synthetic vendor list
 *   3. does NOT mutate canonical comparison handoff (canonical truth 보존)
 *   4. exclude vendors with null price
 *
 * D-3 (request_submission lifecycle events) — 5 it:
 *   1. emitRequestSubmissionExecuted publishes quote_chain event
 *   2. emitRequestSubmissionHandedOffToWorkqueue publishes handoff event
 *   3. invalidation rule for request_submission_executed targets
 *      quote_review surface_only
 *   4. invalidation rule for request_submission_handed_off_to_workqueue
 *      uses state_transition_check scope
 *   5. does NOT introduce new GovernanceDomain — both events stay under
 *      quote_chain (contract drift 방지)
 *
 * smart-sourcing-handoff-engine.ts API (production helper, 9 export):
 *   buildQuoteComparisonHandoff / selectVendorInHandoff /
 *   canHandoffToRequestAssembly / executeHandoffToRequest /
 *   adaptComparisonHandoffToRequestSeed / buildBomParseHandoff /
 *   confirmBomItems / canRegisterToQueue / executeRegisterToQueue
 *
 * Scope (read-only sentinel):
 *   1. sourcing-d2-d3-wiring.test.ts 구조 보존 (2 describe + 9 it)
 *   2. smart-sourcing-handoff-engine.ts 핵심 5 API export 보존
 *   3. canonical truth `QuoteComparisonHandoff` 정의 보존
 *   4. governance event emit 함수 (request_submission_*) 정의 보존
 *
 * Execution (호영님 PowerShell 1회 위임 + Vercel CI 자동):
 *   npm test -- sourcing-d2-d3-wiring.test.ts
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const SMOKE_TEST_SRC = readFileSync(
  resolve(
    REPO_ROOT,
    "apps/web/src/lib/ai/__tests__/sourcing-d2-d3-wiring.test.ts",
  ),
  "utf8",
);
const ENGINE_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/ai/smart-sourcing-handoff-engine.ts"),
  "utf8",
);

describe("§11.305-phase5 — RFQ handoff smoke (sourcing-d2-d3-wiring) 구조 정합 lock", () => {
  it("§11.305-phase5 trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.305-phase5/);
  });

  describe("sourcing-d2-d3-wiring.test.ts 구조 보존", () => {
    it("D-2 describe + 4 it 보존 (adaptComparisonHandoffToRequestSeed)", () => {
      expect(SMOKE_TEST_SRC).toMatch(
        /describe\("D-2 adaptComparisonHandoffToRequestSeed"/,
      );
      // 4 핵심 it 보존
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("synthesizes a request handoff with one product id matching the synthetic product"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("places the recommended vendor first in the synthetic vendor list"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("does not mutate the canonical comparison handoff"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("excludes vendors with null price from synthetic vendor list"/,
      );
    });

    it("D-3 describe + 5 it 보존 (request_submission lifecycle events)", () => {
      expect(SMOKE_TEST_SRC).toMatch(
        /describe\("D-3 request_submission lifecycle events"/,
      );
      // 5 핵심 it 보존
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("emitRequestSubmissionExecuted publishes a quote_chain event with payload metadata"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("emitRequestSubmissionHandedOffToWorkqueue publishes the handoff event"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("invalidation rule for request_submission_executed targets quote_review surface_only"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("invalidation rule for request_submission_handed_off_to_workqueue uses state_transition_check scope"/,
      );
      expect(SMOKE_TEST_SRC).toMatch(
        /it\("does NOT introduce a new GovernanceDomain — both events stay under quote_chain"/,
      );
    });

    it("핵심 import 보존 (5 API + 2 emit)", () => {
      // smart-sourcing-handoff-engine 5 API
      expect(SMOKE_TEST_SRC).toMatch(/adaptComparisonHandoffToRequestSeed/);
      expect(SMOKE_TEST_SRC).toMatch(/buildQuoteComparisonHandoff/);
      expect(SMOKE_TEST_SRC).toMatch(/selectVendorInHandoff/);
      expect(SMOKE_TEST_SRC).toMatch(/executeHandoffToRequest/);
      // governance event 2 emit
      expect(SMOKE_TEST_SRC).toMatch(/emitRequestSubmissionExecuted/);
      expect(SMOKE_TEST_SRC).toMatch(/emitRequestSubmissionHandedOffToWorkqueue/);
    });
  });

  describe("smart-sourcing-handoff-engine.ts production API 보존", () => {
    it("D-2 핵심 5 API export 보존", () => {
      expect(ENGINE_SRC).toMatch(/export function buildQuoteComparisonHandoff/);
      expect(ENGINE_SRC).toMatch(/export function selectVendorInHandoff/);
      expect(ENGINE_SRC).toMatch(/export function canHandoffToRequestAssembly/);
      expect(ENGINE_SRC).toMatch(/export function executeHandoffToRequest/);
      expect(ENGINE_SRC).toMatch(
        /export function adaptComparisonHandoffToRequestSeed/,
      );
    });

    it("BOM handoff 4 API export 보존 (sourcing 외 확장 영역)", () => {
      expect(ENGINE_SRC).toMatch(/export function buildBomParseHandoff/);
      expect(ENGINE_SRC).toMatch(/export function confirmBomItems/);
      expect(ENGINE_SRC).toMatch(/export function canRegisterToQueue/);
      expect(ENGINE_SRC).toMatch(/export function executeRegisterToQueue/);
    });
  });

  describe("Canonical truth + governance domain 정합 (contract drift 방지)", () => {
    it("canonical truth 'QuoteComparisonHandoff' type 사용", () => {
      expect(ENGINE_SRC).toMatch(/QuoteComparisonHandoff/);
    });

    it("governance event domain 'quote_chain' lock (D-3 it 5 정합)", () => {
      // sourcing-d2-d3-wiring.test.ts 의 D-3 it 5 가 검증하는 contract:
      // emitRequestSubmissionExecuted / HandedOffToWorkqueue 가 모두
      // quote_chain domain 안에서만 emit (새 GovernanceDomain 도입 X)
      expect(SMOKE_TEST_SRC).toMatch(/quote_chain/);
      // 새 domain 추가 0 — test 가 이를 직접 검증
      expect(SMOKE_TEST_SRC).toMatch(
        /does NOT introduce a new GovernanceDomain/,
      );
    });

    it("invalidation rule scope 정합 (surface_only + state_transition_check)", () => {
      expect(SMOKE_TEST_SRC).toMatch(/surface_only/);
      expect(SMOKE_TEST_SRC).toMatch(/state_transition_check/);
    });
  });
});
