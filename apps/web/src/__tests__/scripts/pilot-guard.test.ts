/**
 * ADR-002 §6 regression — pilot guard fail-closed contract.
 *
 * Every path that allows production writes must require (1) the
 * exact opt-in token, (2) DATABASE_URL_PILOT present, (3) a non-empty
 * allow list that includes the project-ref in the URL. Missing any
 * one field aborts with a named reason.
 */

import { describe, it, expect } from "vitest";
import {
  checkPilotDatabaseTarget,
  REQUIRED_OPT_IN_TOKEN,
  type PilotDatabaseGuardEnv,
} from "../../../scripts/pilot/guard";

const PROD_REF = "xhidynwpkqeaqjuudhsw";
const OTHER_REF = "abcd1234efgh5678";

function poolerUrl(ref: string): string {
  return `postgresql://postgres.${ref}:pw@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
}

function directUrl(ref: string): string {
  return `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;
}

describe("checkPilotDatabaseTarget — ADR-002 §6 fail-closed guard", () => {
  it("accepts when all three env values align (pooler URL)", () => {
    const env: PilotDatabaseGuardEnv = {
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    };
    const result = checkPilotDatabaseTarget(env);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projectRef).toBe(PROD_REF);
      expect(result.allowList).toEqual([PROD_REF]);
    }
  });

  it("accepts direct (db.<ref>.supabase.co) URL with matching opt-in", () => {
    const env: PilotDatabaseGuardEnv = {
      DATABASE_URL_PILOT: directUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: `${OTHER_REF},${PROD_REF}`,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    };
    expect(checkPilotDatabaseTarget(env).ok).toBe(true);
  });

  it("aborts when PILOT_REQUIRES_EXPLICIT_OPT_IN is missing", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_opt_in_token");
  });

  it("aborts when PILOT_REQUIRES_EXPLICIT_OPT_IN is empty string", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_opt_in_token");
  });

  it("aborts when PILOT_REQUIRES_EXPLICIT_OPT_IN has wrong case / typo", () => {
    const variants = [
      REQUIRED_OPT_IN_TOKEN.toLowerCase(),
      REQUIRED_OPT_IN_TOKEN.toUpperCase() + "!",
      " " + REQUIRED_OPT_IN_TOKEN,
      REQUIRED_OPT_IN_TOKEN + " ",
      "yes-seed-production-pilot-2027",
      "YES_SEED_PRODUCTION_PILOT_2026",
    ];
    for (const v of variants) {
      const result = checkPilotDatabaseTarget({
        DATABASE_URL_PILOT: poolerUrl(PROD_REF),
        ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
        PILOT_REQUIRES_EXPLICIT_OPT_IN: v,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("invalid_opt_in_token");
    }
  });

  it("aborts when DATABASE_URL_PILOT is missing (no fallback)", () => {
    const result = checkPilotDatabaseTarget({
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_pilot_url");
  });

  it("aborts when DATABASE_URL_PILOT is whitespace only", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: "   ",
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("missing_pilot_url");
  });

  it("aborts when ALLOWED_PILOT_DB_SENTINELS is empty", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: "",
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_allow_list");
  });

  it("aborts when ALLOWED_PILOT_DB_SENTINELS is whitespace / commas only", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: " , , ,",
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty_allow_list");
  });

  it("aborts when the URL is unparseable", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: "not a url",
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unparseable_url");
  });

  it("aborts on non-Supabase URLs (e.g., localhost) — project-ref not extractable", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: "postgresql://postgres:pw@localhost:5432/labaxis",
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("project_ref_not_extractable");
  });

  it("aborts when the URL project-ref is NOT in the allow list", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(OTHER_REF),
      ALLOWED_PILOT_DB_SENTINELS: PROD_REF,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.reason).toBe("project_ref_not_in_allow_list");
  });

  it("trims whitespace around allow-list entries", () => {
    const result = checkPilotDatabaseTarget({
      DATABASE_URL_PILOT: poolerUrl(PROD_REF),
      ALLOWED_PILOT_DB_SENTINELS: `  ${PROD_REF}  ,  ignored-ref  `,
      PILOT_REQUIRES_EXPLICIT_OPT_IN: REQUIRED_OPT_IN_TOKEN,
    });
    expect(result.ok).toBe(true);
  });
});
