/**
 * §11.229b #mobile-vendor-request-modal — 호영님 P0 모바일 운영 백로그.
 *
 * 호영님 spec: 웹 VendorRequestModal mobile Expo 분기. scope minimum send-only:
 *   - 단일 vendor email 직접 입력 (현장 ad-hoc 발송 정합).
 *   - read-only quote summary 표시.
 *   - send → POST /api/quotes/[id]/vendor-requests (서버 §11.229c zod 정합).
 *   - 기존 line 248-268 Alert.alert + setTimeout fake success **제거** (dead button → real wiring).
 *
 * Strategy:
 *   - NEW apps/mobile/components/quotes/vendor-request-modal.tsx (RN Modal).
 *   - NEW apps/mobile/hooks/use-vendor-request-mutation.ts (useMutation POST).
 *   - EXTEND apps/mobile/app/quotes/[id].tsx — handleSendRequest swap (modal mount).
 *
 * canonical truth lock:
 *   - 서버 endpoint /api/quotes/[id]/vendor-requests (변경 0, §11.229c zod 정합).
 *   - §11.209d-mobile-mutation RN Modal 패턴 정합 (animationType fade + bg-black/40 backdrop).
 *   - 기존 mobile quotes/[id].tsx detail 페이지 구조 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MODAL_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/components/quotes/vendor-request-modal.tsx",
);
const HOOK_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/hooks/use-vendor-request-mutation.ts",
);
const PAGE_PATH = resolve(
  __dirname,
  "../../../../../apps/mobile/app/quotes/[id].tsx",
);
const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/quotes/[id]/vendor-requests/route.ts",
);

const modal = safeRead(MODAL_PATH);
const hook = safeRead(HOOK_PATH);
const page = safeRead(PAGE_PATH);
const route = safeRead(ROUTE_PATH);

describe("§11.229b #1 — vendor-request-modal RN component", () => {
  it("component file 존재", () => {
    expect(modal.length).toBeGreaterThan(0);
  });

  it("RN Modal import + animationType + transparent (§11.209d-mobile-mutation 패턴 reuse)", () => {
    expect(modal).toMatch(/from\s+["']react-native["']/);
    expect(modal).toMatch(/Modal/);
    expect(modal).toMatch(/animationType=["']fade["']/);
    expect(modal).toMatch(/transparent/);
  });

  it("backdrop pattern (bg-black/40 또는 styled bg)", () => {
    expect(modal).toMatch(/bg-black\/40|bg-black\/50|backgroundColor/);
  });

  it("KeyboardAvoidingView import (Platform.OS 'ios' padding)", () => {
    expect(modal).toMatch(/KeyboardAvoidingView/);
    expect(modal).toMatch(/Platform\.OS/);
  });

  it("vendor email TextInput + name TextInput optional", () => {
    expect(modal).toMatch(/TextInput/);
    expect(modal).toMatch(/(email|이메일)/i);
  });

  it("read-only quote summary 표시 (quote title 또는 summary prop)", () => {
    expect(modal).toMatch(/(quote|title|summary)/i);
  });

  it("send + 취소 button — Pressable 또는 TouchableOpacity", () => {
    expect(modal).toMatch(/(Pressable|TouchableOpacity)/);
    expect(modal).toMatch(/(전송|발송|보내기)/);
    expect(modal).toMatch(/취소/);
  });

  it("loading state — ActivityIndicator + disabled while pending", () => {
    expect(modal).toMatch(/ActivityIndicator/);
    expect(modal).toMatch(/disabled/);
  });

  it("export default VendorRequestModal 또는 named export", () => {
    expect(modal).toMatch(/export\s+(default\s+)?function\s+VendorRequestModal|export\s+\{\s*VendorRequestModal/);
  });
});

describe("§11.229b #2 — useVendorRequestMutation hook", () => {
  it("hook file 존재", () => {
    expect(hook.length).toBeGreaterThan(0);
  });

  it("useMutation from @tanstack/react-query", () => {
    expect(hook).toMatch(/useMutation/);
    expect(hook).toMatch(/@tanstack\/react-query/);
  });

  it("POST /api/quotes/[id]/vendor-requests endpoint", () => {
    expect(hook).toMatch(/\/api\/quotes\/[^"]+vendor-requests|vendor-requests/);
    // apiClient.post (모바일 패턴) 또는 method: "POST" (fetch 패턴) 양방향 매칭
    expect(hook).toMatch(/apiClient\.post|method:\s*["']POST["']/);
  });

  it("body shape — vendors array + email (서버 §11.229c VendorSchema 정합)", () => {
    expect(hook).toMatch(/vendors/);
    expect(hook).toMatch(/email/);
  });

  it("export useVendorRequestMutation", () => {
    expect(hook).toMatch(/export\s+function\s+useVendorRequestMutation|export\s+const\s+useVendorRequestMutation/);
  });
});

describe("§11.229b #3 — quotes/[id].tsx CTA + Modal mount", () => {
  it("VendorRequestModal import", () => {
    expect(page).toMatch(/VendorRequestModal/);
  });

  it("vendorModalOpen state + setVendorModalOpen", () => {
    expect(page).toMatch(/vendorModalOpen|VendorModalVisible|sendModalOpen|sendModalVisible/);
  });

  it("dead button hot fix — Alert.alert + setTimeout fake success **제거**", () => {
    // 기존 "TODO: API 연동" + setTimeout 1200 패턴이 사라져야 함
    expect(page).not.toMatch(/TODO:\s*API\s*연동\s*[—-]\s*sendQuoteRequest/);
    expect(page).not.toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]*setSendState\(["']sent["']\)[\s\S]*?\},\s*1200\)/);
  });

  it("handleSendRequest swap — modal 열기로 변경", () => {
    // setVendorModalOpen(true) 또는 setVendorModalVisible(true) 매칭
    expect(page).toMatch(/setVendorModalOpen\(true\)|setVendorModalVisible\(true\)|setSendModalOpen\(true\)/);
  });
});

describe("§11.229b #4 — invariant 보존", () => {
  it("서버 endpoint /api/quotes/[id]/vendor-requests 보존 (POST + vendors zod)", () => {
    expect(route).toMatch(/export\s+async\s+function\s+POST/);
    expect(route).toMatch(/CreateVendorRequestsSchema/);
    expect(route).toMatch(/VendorSchema/);
  });

  it("§11.229c vendor email TLD blacklist + bare IP refine 보존", () => {
    expect(route).toMatch(/INVALID_TLDS/);
    expect(route).toMatch(/BARE_IP_REGEX/);
  });

  it("§11.209d-mobile-mutation Modal 패턴 보존 (page 안 rejectModalVisible)", () => {
    expect(page).toMatch(/rejectModalVisible/);
    expect(page).toMatch(/animationType=["']fade["']/);
  });

  it("quote.status === 'PENDING' canSend gate 보존", () => {
    expect(page).toMatch(/canSend/);
    expect(page).toMatch(/quote\.status\s*===\s*["']PENDING["']/);
  });

  it("§11.229b trace marker comment", () => {
    const combined = modal + "\n" + hook + "\n" + page;
    expect(combined).toMatch(/§11\.229b|11\.229b/);
  });
});
