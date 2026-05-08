/**
 * #vendor-email-seed-pilot — vendor-requests route + sendEmail integration
 * regression guard.
 *
 * Goal:
 *   - sendEmail signature 가 vendorId optional param 받음.
 *   - sendEmail 안 isVendorPilot 분기 — pilot 이면 SMTP skip.
 *   - vendor-requests route 가 sendEmail call 에 vendorId forward.
 *
 * Source-level regex guard pattern (#supplier-resolution / §11.217 정합).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SENDER_PATH = resolve(__dirname, "../../../lib/email/sender.ts");
const ROUTE_PATH = resolve(__dirname, "../../../app/api/quotes/[id]/vendor-requests/route.ts");

describe("#vendor-email-seed-pilot — sendEmail signature + pilot 분기", () => {
  const senderSource = readFileSync(SENDER_PATH, "utf8");

  it("EmailOptions interface 에 vendorId optional", () => {
    expect(senderSource).toMatch(/vendorId\?:\s*string/);
  });

  it("sendEmail 안 isVendorPilot import 또는 분기", () => {
    expect(senderSource).toMatch(/isVendorPilot|PILOT_VENDOR_ID_PREFIX/);
  });

  it("sendEmail 의 pilot 분기 — SMTP skip + early return", () => {
    // canonical: isVendorPilot(vendorId) 시 SMTP 미수행 + log + return
    expect(senderSource).toMatch(/isVendorPilot[\s\S]*?(skip|dry|pilot|return)/i);
  });

  it("#vendor-email-seed-pilot 주석 marker", () => {
    expect(senderSource).toMatch(/#vendor-email-seed-pilot|pilot vendor|no real outbound/i);
  });
});

describe("#vendor-email-seed-pilot — vendor-requests route forward", () => {
  const routeSource = readFileSync(ROUTE_PATH, "utf8");

  it("sendEmail call 에 vendorId forward", () => {
    // canonical: sendEmail({ to, subject, ..., vendorId })
    // 또는 sendEmail call 의 args 안 vendorId 명시
    expect(routeSource).toMatch(/sendEmail\([\s\S]*?vendorId/);
  });

  it("vendors zod schema 또는 mapping 안 vendor.id 또는 vendorId 명시", () => {
    // route 가 vendor.id 를 어떻게 가져오는지 — schema 확장 또는 lookup
    expect(routeSource).toMatch(/vendor\.id|vendorId|vendor_id/);
  });
});
