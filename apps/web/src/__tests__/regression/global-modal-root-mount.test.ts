/**
 * §global-modal-root (2026-09-07) — 모달 렌더러는 **정확히 한 곳**에 마운트된다.
 *
 * 🔴 배경: 헤더 교체로 `DashboardHeader` 가 자체 셸 8곳에 붙었는데, 그 화면들은
 *    `DashboardShell` 을 쓰지 않아 `GlobalModal` 이 없었다 → 스캔 버튼이 store 만 바꾸고
 *    **아무것도 안 뜨는 dead button**(CLAUDE.md 절대 원칙 위반).
 * 🔑 처방은 소비처에 하나씩 붙이는 게 아니라 **루트로 올리는 것**이다 —
 *    마운트를 소비처가 기억해야 하는 규칙은 아홉 번째에서 또 빠진다(§sidebar-spacer 와 같은 판단).
 * 🛑 위로 올렸으면 아래는 비운다. 둘 다 있으면 store 하나에 렌더러 둘이 붙어
 *    `/dashboard/*` 에서 모달이 겹친다(포커스 트랩·애니메이션 충돌).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(WEB_ROOT, "src");

/** `<GlobalModal` 을 렌더하는 파일 전량 — 목록을 손으로 적지 않는다(표류 방지). */
function mountSites(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "__tests__") continue;
        walk(full);
      } else if (/\.tsx$/.test(e.name)) {
        const src = readFileSync(full, "utf8");
        // 주석은 세지 않는다 — 제거 근거를 주석으로 남겨 두기 때문이다
        const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
        if (/<GlobalModal\b/.test(code)) out.push(relative(SRC, full).split(String.fromCharCode(92)).join("/"));
      }
    }
  })(SRC);
  return out.sort();
}

describe("§global-modal-root — 렌더러는 정확히 하나", () => {
  it("🔑 마운트 지점이 루트 레이아웃 **한 곳**이다", () => {
    /* 0 이면 dead button 이 돌아오고, 2 이상이면 모달이 겹친다. 둘 다 RED 여야 한다. */
    expect(mountSites()).toEqual(["app/layout.tsx"]);
  });

  it("🛑 QRScannerProviderWrapper **안**에 있다 (원래 컨텍스트 집합 보존)", () => {
    /* 원래 위치(dashboard-shell)가 children 안이라 이 프로바이더 아래였다.
     * `Toaster` 층(바깥)에 두면 모달이 쓰는 컨텍스트가 달라진다. */
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    const open = layout.indexOf("<QRScannerProviderWrapper>");
    const close = layout.indexOf("</QRScannerProviderWrapper>");
    const modal = layout.indexOf("<GlobalModal");
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    expect(modal).toBeGreaterThan(open);
    expect(modal).toBeLessThan(close);
  });

  it("스캔 버튼이 실재한다 (모달을 여는 쪽 — 짝이 끊기면 알린다)", () => {
    const header = readFileSync(join(SRC, "components", "dashboard", "Header.tsx"), "utf8");
    expect(header).toMatch(/data-testid="header-scan-entry"/);
    expect(header).toMatch(/openModal\("scan_hub"\)/);
  });
});
