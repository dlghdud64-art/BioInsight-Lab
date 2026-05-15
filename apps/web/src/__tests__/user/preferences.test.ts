/**
 * §11.230c (a) #user-preferences-server-persist — 호영님 §11.230b 백로그 잔재.
 *
 * 호영님 spec: column prefs (widths/visibility/order) 를 user account 에 영구화.
 *   localStorage only → DB User.preferences JSON 으로 cross-device sync. 기존
 *   localStorage 는 backward compat (server fetch 실패 시 fallback) 으로 유지.
 *
 * Strategy:
 *   - schema User.preferences Json? (generic — 후속 briefing collapse 등 통합).
 *   - migration SQL ALTER TABLE ADD COLUMN IF NOT EXISTS preferences JSONB.
 *   - GET /api/user/preferences (auth gate + user.preferences select).
 *   - PATCH /api/user/preferences (auth gate + zod merge update).
 *   - useUserPreferences hook (useQuery + useMutation debounced).
 *   - quotes/page.tsx hydration/persistence useEffect 2 swap.
 *
 * canonical truth lock:
 *   - §11.230b ColumnPrefs / DEFAULT_COLUMN_PREFS / COLUMN_PREFS_LS_KEY 보존
 *     (localStorage fallback 정합).
 *   - §11.248e-2 BRIEFING_COLLAPSED_LS_KEY 보존 (별도 cluster, 본 batch 영향 0).
 *   - 기존 column resize / popover UI 모두 setColumnPrefs trigger 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const SCHEMA_PATH = resolve(__dirname, "../../../prisma/schema.prisma");
const MIGRATIONS_DIR = resolve(__dirname, "../../../prisma/migrations");
const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/user/preferences/route.ts",
);
const HELPER_PATH = resolve(
  __dirname,
  "../../lib/preferences/user-preferences.ts",
);
const PAGE_PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");

const schema = safeRead(SCHEMA_PATH);
const route = safeRead(ROUTE_PATH);
const helper = safeRead(HELPER_PATH);
const page = safeRead(PAGE_PATH);

const migrationDir = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).find((d) => /^\d+_user_preferences$/.test(d))
  : undefined;
const migration = migrationDir
  ? safeRead(resolve(MIGRATIONS_DIR, migrationDir, "migration.sql"))
  : "";

describe("§11.230c (a) #1 — schema User.preferences Json?", () => {
  it("model User 안 preferences Json? field", () => {
    expect(schema).toMatch(/model\s+User\s*\{[\s\S]+?preferences\s+Json\?/);
  });
});

describe("§11.230c (a) #2 — migration SQL", () => {
  it("migration 디렉토리 존재 (_user_preferences)", () => {
    expect(migrationDir).toBeTruthy();
  });

  it("ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS preferences", () => {
    expect(migration).toMatch(
      /ALTER\s+TABLE\s+"User"[\s\S]{0,200}ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS[\s\S]{0,100}"preferences"/i,
    );
  });

  it("JSONB column type", () => {
    expect(migration).toMatch(/"preferences"\s+JSONB/);
  });
});

describe("§11.230c (a) #3 — GET/PATCH /api/user/preferences", () => {
  it("GET handler export", () => {
    expect(route).toMatch(/export\s+async\s+function\s+GET/);
  });

  it("PATCH handler export", () => {
    expect(route).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("auth() session gate + 401", () => {
    expect(route).toMatch(/auth\(\)/);
    expect(route).toMatch(/status:\s*401/);
  });

  it("db.user.findUnique (GET) — preferences select", () => {
    expect(route).toMatch(/db\.user\.findUnique[\s\S]{0,500}preferences/);
  });

  it("db.user.update (PATCH) — preferences update", () => {
    expect(route).toMatch(/db\.user\.update[\s\S]{0,500}preferences/);
  });

  it("zod schema validation (PATCH body)", () => {
    expect(route).toMatch(/z\.object|safeParse|parse/);
  });
});

describe("§11.230c (a) #4 — useUserPreferences helper hook", () => {
  it("'use client' directive", () => {
    expect(helper).toMatch(/^['"]use client['"]/m);
  });

  it("export useUserPreferences hook", () => {
    expect(helper).toMatch(/export\s+function\s+useUserPreferences/);
  });

  it("useQuery (server fetch)", () => {
    expect(helper).toMatch(/useQuery/);
    expect(helper).toMatch(/\/api\/user\/preferences/);
  });

  it("useMutation (PATCH update)", () => {
    expect(helper).toMatch(/useMutation/);
  });

  it("debounce (rapid update 차단, 200~500ms)", () => {
    // setTimeout 또는 debounce 라이브러리 import — 양방향 매칭
    expect(helper).toMatch(/setTimeout|debounce|clearTimeout/);
  });
});

describe("§11.230c (a) #5 — quotes/page.tsx server-first hydration", () => {
  it("useUserPreferences import", () => {
    expect(page).toMatch(/useUserPreferences/);
  });

  it("server fetch fallback chain (server → localStorage → DEFAULT)", () => {
    // server fetched value 또는 localStorage 또는 DEFAULT 매칭
    expect(page).toMatch(/preferences[\s\S]{0,400}columnPrefs[\s\S]{0,400}(localStorage|DEFAULT_COLUMN_PREFS)/);
  });

  it("debounced server PATCH on columnPrefs change", () => {
    // useUserPreferences hook 의 mutate 함수 호출 매칭 (updateColumnPrefs)
    expect(page).toMatch(/(updateColumnPrefs|updatePreferences|mutate|setUserPreferences)/);
  });
});

describe("§11.230c (a) #6 — invariant 보존", () => {
  it("§11.230b ColumnPrefs type 보존", () => {
    expect(page).toMatch(/interface\s+ColumnPrefs|type\s+ColumnPrefs/);
  });

  it("§11.230b DEFAULT_COLUMN_PREFS 보존", () => {
    expect(page).toMatch(/const\s+DEFAULT_COLUMN_PREFS/);
  });

  it("§11.230b COLUMN_PREFS_LS_KEY 보존 (localStorage fallback)", () => {
    expect(page).toMatch(/COLUMN_PREFS_LS_KEY/);
    expect(page).toMatch(/labaxis-quote-column-prefs/);
  });

  it("§11.248e-2 BRIEFING_COLLAPSED_LS_KEY 보존 (별도 cluster)", () => {
    expect(page).toMatch(/BRIEFING_COLLAPSED_LS_KEY/);
  });

  it("§11.230c (a) trace marker", () => {
    const combined = route + "\n" + helper + "\n" + page;
    expect(combined).toMatch(/§11\.230c \(a\)|11\.230c \(a\)|§11\.230c-a/);
  });
});
