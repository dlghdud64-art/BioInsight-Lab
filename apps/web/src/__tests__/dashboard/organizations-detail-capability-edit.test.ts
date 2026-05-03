/**
 * §11.193d Phase 3 Phase 1 — RED.
 *
 * organizations/[id] page 의 권한 변경 Dialog 안에 workflowCapabilities
 * checkbox section 이 wired 되어 있는지 강제. source-level smoke
 * (text/regex) 로 contract 명문화 — UI render assertion 은 별도 트랙.
 *
 * 본 test 가 GREEN 되려면 page.tsx 가 다음을 모두 만족:
 *   1. updateCapabilitiesMutation 정의 (또는 동치 명칭)
 *   2. PATCH /api/organizations/{id}/members/{memberId}/capabilities 호출
 *   3. invalidate ["organization-members", params.id] +
 *                ["settings-organizations"] (settings page multi-badge 갱신)
 *   4. 기존 permission dialog 안에 3 한국어 capability 라벨 노출
 *      ("운영 책임자" / "승인자" / "요청자" — WORKFLOW_CAPABILITY_LABEL)
 *   5. Checkbox import 가 wired (shadcn/ui)
 *
 * Plan: docs/plans/PLAN_workflow-capabilities-phase-3-onboarding.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../app/dashboard/organizations/[id]/page.tsx",
);
const SOURCE = readFileSync(PAGE_PATH, "utf8");

describe("§11.193d Phase 3 — capability edit dialog wiring", () => {
  it("updateCapabilitiesMutation (또는 capabilities 토글 mutation) 정의", () => {
    // mutation name 은 자유 (updateCapabilitiesMutation / capabilitiesMutation
    // / updateCapabilityMutation 등) 이지만 capability 키워드 + useMutation 결합 필수.
    // case-flexible: 첫 글자 대/소문자 모두 허용 (camelCase / PascalCase 둘 다).
    expect(SOURCE).toMatch(
      /[Cc]apabilit\w*Mutation\s*=\s*useMutation\(/,
    );
  });

  it("PATCH /api/organizations/{id}/members/{memberId}/capabilities 호출", () => {
    // path template literal: /api/organizations/${params.id}/members/${...}/capabilities
    expect(SOURCE).toMatch(
      /\/api\/organizations\/\$\{[^}]+\}\/members\/\$\{[^}]+\}\/capabilities/,
    );
  });

  it("PATCH method 명시", () => {
    // capabilities mutation 의 fetch 가 method: PATCH 를 사용 (다른 mutation 도
    // PATCH 쓰므로 같은 string 이 여러 번 등장 — 본 test 는 capabilities 근처
    // PATCH 가 1+ 존재만 강제).
    const capabilityBlockMatch = SOURCE.match(
      /capabilit[\s\S]{0,400}method:\s*["']PATCH["']/,
    );
    expect(capabilityBlockMatch).not.toBeNull();
  });

  it("invalidate organization-members + settings-organizations", () => {
    // capabilities mutation 의 onSuccess 가 두 query key 모두 invalidate.
    expect(SOURCE).toMatch(
      /invalidateQueries[\s\S]{0,200}organization-members/,
    );
    expect(SOURCE).toMatch(
      /invalidateQueries[\s\S]{0,200}settings-organizations/,
    );
  });

  it("3 한국어 capability 라벨 노출 (WORKFLOW_CAPABILITY_LABEL 정합)", () => {
    // workflow-capabilities.ts 의 WORKFLOW_CAPABILITY_LABEL 와 같은 한국어 노출.
    expect(SOURCE).toMatch(/운영 책임자/);
    expect(SOURCE).toMatch(/승인자/);
    expect(SOURCE).toMatch(/요청자/);
  });

  it("Checkbox component import (shadcn/ui)", () => {
    // capability 토글은 checkbox 패턴.
    expect(SOURCE).toMatch(
      /import\s+\{[^}]*Checkbox[^}]*\}\s+from\s+["']@\/components\/ui\/checkbox["']/,
    );
  });

  it("workflow-capabilities resolver / label import (canonical truth 정합)", () => {
    // page 가 raw enum 을 직접 한국어로 hardcode 하지 않고 canonical source
    // (lib/permissions/workflow-capabilities) 에서 import.
    expect(SOURCE).toMatch(
      /from\s+["']@\/lib\/permissions\/workflow-capabilities["']/,
    );
  });

  it("기존 permission dialog 보존 (회귀 0)", () => {
    // Phase 1 추가는 dialog 안에 section 추가 — dialog 자체 제거 금지.
    expect(SOURCE).toMatch(
      /Dialog\s+open=\{permissionDialogOpen\}\s+onOpenChange=\{setPermissionDialogOpen\}/,
    );
  });
});
