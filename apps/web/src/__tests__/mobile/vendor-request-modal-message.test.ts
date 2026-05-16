/**
 * §11.229b-2 #mobile-vendor-request-message — 호영님 §11.229b 자연 후속.
 *
 * 호영님 spec: vendor request modal 에 message TextInput 추가 (운영자 현장
 *   메모 편집). 서버 endpoint message?: optional 이미 지원 (§11.229c 정합).
 *
 * Strategy:
 *   - modal 안 message useState + TextInput multiline + handleSubmit body 포함.
 *   - hook 변경 0 (이미 message? 시그니처 있음).
 *
 * canonical truth lock:
 *   - §11.229b RN Modal 시그니처 보존 (animationType + KeyboardAvoidingView).
 *   - 서버 CreateVendorRequestsSchema message?: optional 보존.
 *   - vendor email TextInput / 전송 button / canSubmit gate 보존.
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
const ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/quotes/[id]/vendor-requests/route.ts",
);

const modal = safeRead(MODAL_PATH);
const hook = safeRead(HOOK_PATH);
const route = safeRead(ROUTE_PATH);

describe("§11.229b-2 #1 — modal message TextInput", () => {
  it("message useState 추가", () => {
    expect(modal).toMatch(/(setMessage|message)/);
    expect(modal).toMatch(/useState/);
  });

  it("message TextInput multiline", () => {
    // multiline TextInput 매칭 — vendor email/name TextInput 외 추가
    expect(modal).toMatch(/multiline/);
  });

  it("message TextInput placeholder (한국어 안내)", () => {
    // 메시지 / 메모 / 안내 placeholder 양방향 매칭
    expect(modal).toMatch(/(메시지|메모|안내|message)/i);
  });

  it("handleSubmit 안 message 포함 (mutation body)", () => {
    // mutation.mutate({ ... message ... }) 매칭
    expect(modal).toMatch(/mutate[\s\S]{0,400}message/);
  });

  it("message editable while not pending (disabled when pending)", () => {
    // disabled 패턴 reuse — message TextInput 도 editable={!isPending}
    expect(modal).toMatch(/editable=\{!isPending\}/);
  });
});

describe("§11.229b-2 #2 — invariant 보존", () => {
  it("§11.229b RN Modal animationType fade + transparent 보존", () => {
    expect(modal).toMatch(/animationType=["']fade["']/);
    expect(modal).toMatch(/transparent/);
  });

  it("§11.229b vendor email TextInput + name TextInput 보존", () => {
    expect(modal).toMatch(/vendorEmail/);
    expect(modal).toMatch(/vendorName/);
    expect(modal).toMatch(/keyboardType=["']email-address["']/);
  });

  it("§11.229b 전송 button + 취소 button 보존", () => {
    expect(modal).toMatch(/전송/);
    expect(modal).toMatch(/취소/);
  });

  it("§11.229b canSubmit gate + ActivityIndicator 보존", () => {
    expect(modal).toMatch(/canSubmit/);
    expect(modal).toMatch(/ActivityIndicator/);
  });

  it("§11.229b useVendorRequestMutation hook 시그니처 보존", () => {
    expect(hook).toMatch(/useVendorRequestMutation/);
    expect(hook).toMatch(/vendor-requests/);
    // message 는 hook 의 mutationFn input 에 이미 있음 (§11.229b 정합)
    expect(hook).toMatch(/message/);
  });

  it("§11.229c 서버 CreateVendorRequestsSchema message optional 보존", () => {
    expect(route).toMatch(/message:\s*z\.string\(\)\.optional/);
  });

  it("§11.229b-2 trace marker comment", () => {
    expect(modal).toMatch(/§11\.229b-2|11\.229b-2/);
  });
});
