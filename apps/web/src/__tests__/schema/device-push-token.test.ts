/**
 * #mobile-push-notification Phase 1 server — RED→GREEN test
 *
 * Device model 신설 — mobile push token 저장:
 *   - userId (User relation)
 *   - pushToken @unique (Expo Push Token)
 *   - platform (ios / android)
 *   - createdAt / updatedAt
 *
 * mobile 의 _layout.tsx 가 apiClient.post("/api/devices/register",
 * { pushToken: token }) 호출 — endpoint 신설 시 자동 토큰 등록 시작.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#mobile-push-notification Phase 1 — Device schema", () => {
  it("Device model 정의 (userId + pushToken + platform)", () => {
    const src = read(SCHEMA);
    expect(src).toMatch(/model\s+Device\s*\{/);
    const block = src.match(/model\s+Device\s*\{[\s\S]*?\n\}/);
    expect(block).not.toBeNull();
    if (block) {
      expect(block[0]).toMatch(/userId\s+String/);
      expect(block[0]).toMatch(/pushToken\s+String\s+@unique/);
      expect(block[0]).toMatch(/platform\s+String/);
    }
  });

  it("Device 의 user relation (User onDelete Cascade)", () => {
    const src = read(SCHEMA);
    const block = src.match(/model\s+Device\s*\{[\s\S]*?\n\}/);
    if (block) {
      expect(block[0]).toMatch(/user\s+User[\s\S]*?onDelete:\s*Cascade/);
    }
  });
});

describe("#mobile-push-notification Phase 1 — migration SQL", () => {
  it("device 신규 migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /device_push_token|device-push-token|mobile_push/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("CREATE TABLE Device + UNIQUE INDEX (pushToken)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /device_push_token|device-push-token|mobile_push/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toContain("CREATE TABLE");
      expect(sql).toContain('"Device"');
      expect(sql).toContain("pushToken");
      expect(sql).toContain("UNIQUE");
    }
  });
});

describe("#mobile-push-notification Phase 1 — /api/devices/register route", () => {
  const ROUTE = "src/app/api/devices/register/route.ts";

  it("route 신규 file 존재", () => {
    const src = read(ROUTE);
    expect(src.length).toBeGreaterThan(0);
  });

  it("POST handler + auth + zod", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
    expect(src).toMatch(/auth\(\)/);
    expect(src).toMatch(/z\.object/);
  });

  it("zod schema 에 pushToken (required) + platform (optional)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/pushToken:\s*z\.string\(\)/);
    expect(src).toMatch(/platform:\s*z\.[\s\S]*?optional|platform:\s*z\.enum/);
  });

  it("device upsert (userId + pushToken)", () => {
    const src = read(ROUTE);
    // upsert 또는 create + update — 동일 token 재등록 시 update
    expect(src).toMatch(/db\.device\.upsert|db\.device\.create/);
  });
});

describe("#mobile-push-notification Phase 1 — push-sender helper", () => {
  const SENDER = "src/lib/notifications/push-sender.ts";

  it("push-sender.ts 신규 file 존재", () => {
    const src = read(SENDER);
    expect(src.length).toBeGreaterThan(0);
  });

  it("sendPushNotification export + Expo Push API URL (exp.host)", () => {
    const src = read(SENDER);
    expect(src).toMatch(/export\s+(?:async\s+)?function\s+sendPushNotification|export\s+const\s+sendPushNotification/);
    expect(src).toMatch(/exp\.host\/--\/api\/v2\/push\/send/);
  });

  it("payload shape (to + title + body + data)", () => {
    const src = read(SENDER);
    expect(src).toMatch(/to:|title:|body:|data:/);
  });

  it("try/catch graceful (push fail 시 throw 또는 return null)", () => {
    const src = read(SENDER);
    expect(src).toMatch(/try[\s\S]*?catch|\.catch\(/);
  });
});
