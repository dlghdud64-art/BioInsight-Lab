/**
 * ADR-001 §6.1 regression — project-ref guard for isolated WRITE smoke.
 *
 * Targets the pure `checkSmokeDatabaseTarget` function so we never touch
 * process.exit inside the test runner. The runner-facing
 * `assertSmokeDatabaseTarget` delegates to this pure form, so locking
 * the pure contract locks the runner too.
 */

import { describe, it, expect } from "vitest";
import {
  checkSmokeDatabaseTarget,
  type SmokeDatabaseGuardEnv,
} from "../../../scripts/smoke/guard";

const TEST_REF = "abcd1234efgh5678";
const PROD_REF = "zzzz9999yyyy8888";

function poolerUrl(ref: string): string {
  return `postgresql://postgres.${ref}:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
}

function directUrl(ref: string): string {
  return `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;
}

describe("checkSmokeDatabaseTarget — ADR-001 §6.1 project-ref guard", () => {
  it("accepts a pooler URL whose project-ref is in the allow list", () => {
    const env: SmokeDatabaseGuardEnv = {
      DATABASE_URL_SMOKE: poolerUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
      PRODUCTION_DB_PROJECT_REF: PROD_REF,
    };
    const result = checkSmokeDatabaseTarget(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projectRef).toBe(TEST_REF);
      expect(result.allowList).toEqual([TEST_REF]);
    }
  });

  it("accepts a direct (db.<ref>.supabase.co) URL whose ref is allow-listed", () => {
    const env: SmokeDatabaseGuardEnv = {
      DATABASE_URL_SMOKE: directUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: `${TEST_REF},another-allowed-ref`,
      PRODUCTION_DB_PROJECT_REF: PROD_REF,
    };
    const result = checkSmokeDatabaseTarget(env);
    expect(result.ok).toBe(true);
  });

  it("aborts when DATABASE_URL_SMOKE is missing (no fallback to DATABASE_URL)", () => {
    const result = checkSmokeDatabaseTarget({
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_smoke_url");
  });

  it("aborts when DATABASE_URL_SMOKE is empty string", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: "   ",
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_smoke_url");
  });

  it("aborts when the allow list is empty", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: poolerUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_allow_list");
  });

  it("aborts when the allow list contains only whitespace", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: poolerUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: " , , ,",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_allow_list");
  });

  it("aborts when production project-ref sneaks into the allow list (self-guard)", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: poolerUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: `${TEST_REF},${PROD_REF}`,
      PRODUCTION_DB_PROJECT_REF: PROD_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toBe("production_ref_in_allow_list");
  });

  it("aborts when the connection URL project-ref is NOT in the allow list", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: poolerUrl(PROD_REF),
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
      PRODUCTION_DB_PROJECT_REF: PROD_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toBe("project_ref_not_in_allow_list");
  });

  it("aborts on unparseable DATABASE_URL_SMOKE", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: "not a url at all",
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unparseable_url");
  });

  it("aborts when URL has no extractable Supabase project-ref (e.g. localhost)", () => {
    const result = checkSmokeDatabaseTarget({
      DATABASE_URL_SMOKE: "postgresql://postgres:pw@localhost:5432/labaxis",
      ALLOWED_SMOKE_DB_SENTINELS: TEST_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("project_ref_not_extractable");
  });

  it("trims whitespace around allow-list entries", () => {
    const env: SmokeDatabaseGuardEnv = {
      DATABASE_URL_SMOKE: poolerUrl(TEST_REF),
      ALLOWED_SMOKE_DB_SENTINELS: `  ${TEST_REF}  ,  ignored-other  `,
      PRODUCTION_DB_PROJECT_REF: PROD_REF,
    };
    const result = checkSmokeDatabaseTarget(env);
    expect(result.ok).toBe(true);
  });
});
