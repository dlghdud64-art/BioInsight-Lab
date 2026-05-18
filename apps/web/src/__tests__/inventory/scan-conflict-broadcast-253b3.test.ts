/**
 * §11.253b-3 — 본인 다른 탭 detection (case 1, BroadcastChannel API).
 *
 * 호영님 spec case 1:
 *   "Info (파란색) — 다른 탭에서 작업 중입니다. 이 탭에서 계속하시겠습니까?"
 *
 * 전략: client-side BroadcastChannel("labaxis-inventory-edit")
 *   - LabelScannerModal mount + scanResult set 시 broadcast.
 *   - 같은 origin 다른 탭 listener 가 같은 productId/lotNumber 받으면 Info
 *     banner 노출 (own tab 메시지는 tabId 검증으로 skip).
 *
 * canonical truth lock:
 *   - backend 변경 0 (client-side only).
 *   - §11.253 case 3 (red Error) + §11.253b-1 행위자/시간 모두 보존.
 *   - §11.253b-2 case 2 (다른 사용자) 별도 cluster (lock infra 필요).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const HOOK_PATH = resolve(__dirname, "../../hooks/use-inventory-edit-broadcast.ts");
const MODAL_PATH = resolve(__dirname, "../../components/inventory/LabelScannerModal.tsx");
const hookCode = safeRead(HOOK_PATH);
const modalCode = safeRead(MODAL_PATH);

describe("§11.253b-3 #1 — useInventoryEditBroadcast hook", () => {
  it("§11.253b-3 trace marker (hook)", () => {
    expect(hookCode).toMatch(/§11\.253b-3|11\.253b-3/);
  });

  it("hook export — useInventoryEditBroadcast", () => {
    expect(hookCode).toMatch(/export\s+function\s+useInventoryEditBroadcast|export\s+const\s+useInventoryEditBroadcast/);
  });

  it("BroadcastChannel 사용 + 'labaxis-inventory-edit' channel name", () => {
    expect(hookCode).toMatch(/new\s+BroadcastChannel\(/);
    expect(hookCode).toMatch(/labaxis-inventory-edit/);
  });

  it("tabId 생성 (own tab 메시지 skip)", () => {
    // crypto.randomUUID() 또는 Math.random() 으로 tabId 생성.
    expect(hookCode).toMatch(/(crypto\.randomUUID|Math\.random|tabId)/);
  });

  it("useEffect cleanup — channel.close()", () => {
    expect(hookCode).toMatch(/\.close\(\)/);
  });

  it("SSR safe — typeof window 또는 typeof BroadcastChannel check", () => {
    expect(hookCode).toMatch(/typeof\s+(window|BroadcastChannel)/);
  });
});

describe("§11.253b-3 #2 — LabelScannerModal broadcast 통합", () => {
  it("§11.253b-3 trace marker (modal)", () => {
    expect(modalCode).toMatch(/§11\.253b-3|11\.253b-3/);
  });

  it("useInventoryEditBroadcast hook import 또는 사용", () => {
    expect(modalCode).toMatch(/useInventoryEditBroadcast/);
  });

  it("Info banner — '다른 탭' 텍스트 + 파란 톤 (border-blue 또는 bg-blue)", () => {
    expect(modalCode).toMatch(/다른\s*탭/);
    expect(modalCode).toMatch(/(border-blue|bg-blue|text-blue)/);
  });
});

describe("§11.253b-3 — invariant 보존", () => {
  it("§11.253 red Error banner (case 3) 보존", () => {
    expect(modalCode).toMatch(/border-red-200/);
    expect(modalCode).toMatch(/그래도\s*진행/);
  });

  it("§11.253b-1 RelativeTimeText (시간/행위자) 보존", () => {
    expect(modalCode).toMatch(/RelativeTimeText/);
    expect(modalCode).toMatch(/마지막으로\s*수정/);
  });

  it("conflictAck state 보존", () => {
    expect(modalCode).toMatch(/conflictAck/);
  });

  it("matchedInventory shape 보존 (productId/lotNumber 등)", () => {
    expect(modalCode).toMatch(/matchedInventory/);
    expect(modalCode).toMatch(/lotNumber/);
  });
});
