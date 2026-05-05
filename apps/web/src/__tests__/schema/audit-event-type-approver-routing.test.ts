/**
 * #approver-routing-event-type-enum-add — RED→GREEN test
 *
 * AuditEventType enum 에 2 dedicated values 추가:
 *   - WORKSPACE_THRESHOLD_CHANGED — workspace 결재 임계치 변경
 *   - PURCHASE_REQUEST_CREATED — PR INSERT + 결재 매핑
 *
 * 직전 #approver-routing-audit-log 의 generic enum (SETTINGS_CHANGED /
 * WORK_QUEUE_TASK_GENERATED) → dedicated enum 으로 swap. audit log 의미
 * 명확화 (filter / search 정합).
 *
 * Scope:
 *   - schema.prisma 의 enum 2 values 추가
 *   - migration SQL ALTER TYPE ADD VALUE
 *   - event-labels.ts 한국어 label + tone 매핑
 *   - 2 caller swap (workspace PATCH + request-approval)
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SCHEMA = "prisma/schema.prisma";
const MIGRATIONS_DIR = "prisma/migrations";
const LABELS = "src/lib/audit/event-labels.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-event-type-enum-add — schema enum", () => {
  it("AuditEventType enum 안에 WORKSPACE_THRESHOLD_CHANGED 추가", () => {
    const src = read(SCHEMA);
    const enumBlock = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(enumBlock).not.toBeNull();
    if (enumBlock) {
      expect(enumBlock[0]).toMatch(/WORKSPACE_THRESHOLD_CHANGED/);
    }
  });

  it("AuditEventType enum 안에 PURCHASE_REQUEST_CREATED 추가", () => {
    const src = read(SCHEMA);
    const enumBlock = src.match(/enum\s+AuditEventType\s*\{[\s\S]*?\n\}/);
    expect(enumBlock).not.toBeNull();
    if (enumBlock) {
      expect(enumBlock[0]).toMatch(/PURCHASE_REQUEST_CREATED/);
    }
  });
});

describe("#approver-routing-event-type-enum-add — migration SQL", () => {
  it("ALTER TYPE migration 디렉토리 존재", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const found = entries.some((e) =>
      /event_type_approver|approver_routing_event|threshold_changed|purchase_request_created/i.test(e),
    );
    expect(found).toBe(true);
  });

  it("ALTER TYPE AuditEventType ADD VALUE (2 values)", () => {
    const dir = join(REPO_ROOT, MIGRATIONS_DIR);
    const entries = readdirSync(dir);
    const target = entries.find((e) =>
      /event_type_approver|approver_routing_event|threshold_changed|purchase_request_created/i.test(e),
    );
    expect(target).toBeDefined();
    if (target) {
      const sqlPath = join(dir, target, "migration.sql");
      expect(existsSync(sqlPath)).toBe(true);
      const sql = readFileSync(sqlPath, "utf8");
      expect(sql).toMatch(/ALTER\s+TYPE\s+"AuditEventType"\s+ADD\s+VALUE/);
      expect(sql).toMatch(/WORKSPACE_THRESHOLD_CHANGED/);
      expect(sql).toMatch(/PURCHASE_REQUEST_CREATED/);
    }
  });
});

describe("#approver-routing-event-type-enum-add — event-labels.ts", () => {
  it("WORKSPACE_THRESHOLD_CHANGED 한국어 label + tone storage", () => {
    const src = read(LABELS);
    expect(src).toMatch(/WORKSPACE_THRESHOLD_CHANGED:\s*\{[\s\S]*?label:\s*["'][^"']*결재 임계치[^"']*["'][\s\S]*?tone:\s*["']storage["']/);
  });

  it("PURCHASE_REQUEST_CREATED 한국어 label + tone register", () => {
    const src = read(LABELS);
    expect(src).toMatch(/PURCHASE_REQUEST_CREATED:\s*\{[\s\S]*?label:\s*["'][^"']*결재 요청[^"']*["'][\s\S]*?tone:\s*["']register["']/);
  });
});

describe("#approver-routing-event-type-enum-add — caller swap", () => {
  const WORKSPACE_ROUTE = "src/app/api/workspaces/[id]/route.ts";
  const REQUEST_APPROVAL_ROUTE =
    "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

  it("workspace PATCH route 가 WORKSPACE_THRESHOLD_CHANGED 사용 (SETTINGS_CHANGED 잔존 0)", () => {
    const src = read(WORKSPACE_ROUTE);
    expect(src).toMatch(/eventType:\s*["']WORKSPACE_THRESHOLD_CHANGED["']/);
    // SETTINGS_CHANGED 의 audit caller 잔존 0 (직전 batch 의 SETTINGS_CHANGED 만)
    expect(src).not.toMatch(/eventType:\s*["']SETTINGS_CHANGED["']/);
  });

  it("request-approval route 가 PURCHASE_REQUEST_CREATED 사용 (WORK_QUEUE_TASK_GENERATED 잔존 0)", () => {
    const src = read(REQUEST_APPROVAL_ROUTE);
    expect(src).toMatch(/eventType:\s*["']PURCHASE_REQUEST_CREATED["']/);
    expect(src).not.toMatch(/eventType:\s*["']WORK_QUEUE_TASK_GENERATED["']/);
  });
});
