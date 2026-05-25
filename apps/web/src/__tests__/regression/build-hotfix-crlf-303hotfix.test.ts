/**
 * §11.303-hotfix #build-hotfix-crlf — 2 fail file CRLF → LF 변환 hotfix.
 *
 * Critical 발견 (2026-05-25):
 * §11.298 + §11.298c 이후 20 Vercel deployment 연속 ERROR (§11.299 ~
 * §11.303c). build log:
 *   ./src/app/dashboard/organizations/[id]/page.tsx:475-480
 *     x Unexpected token `div`. Expected jsx identifier
 *   ./src/app/settings/workspace/page.tsx:388-393
 *     x Unexpected token `div`. Expected jsx identifier
 *
 * Root cause: CRLF line endings (Windows `\r\n`).
 *   organizations/[id]/page.tsx: 1676 CRLF lines
 *   settings/workspace/page.tsx: 779 CRLF lines
 * SWC parser 가 JSX 안 `\r` 을 invisible character 으로 인식 → line
 * tracking 오류 + Unexpected token. 한글 (UTF-8 multi-byte) + 깊은
 * nesting 조합에서 특히 fail.
 *
 * Hotfix scope:
 *   - 2 fail file 만 LF 변환 (다른 1849 file 은 정상 빌드, normalize
 *     별도 batch §11.303-hotfix-b 후보)
 *   - sentinel test — 2 file CRLF 0 회귀 차단
 *   - .gitattributes 권장 (별도 batch §11.303-hotfix-c)
 *
 * 향후 normalize batch (§11.303-hotfix-b/c):
 *   - apps/web/src 전체 1849 file CRLF → LF
 *   - .gitattributes `* text=auto eol=lf` 추가 (Windows 환경 자동 변환)
 *   - pre-commit hook (호영님 환경) CRLF 차단
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

function readBuffer(relPath: string): Buffer {
  return readFileSync(resolve(REPO_ROOT, relPath));
}

function countCRLF(buffer: Buffer): number {
  let count = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0d /* \r */) count++;
  }
  return count;
}

describe("§11.303-hotfix — Vercel 빌드 fail 2 file CRLF → LF 변환", () => {
  it("§11.303-hotfix trace marker (self-referential sentinel)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.303-hotfix/);
  });

  describe("CRLF 0 회귀 차단", () => {
    it("organizations/[id]/page.tsx — CRLF 0 (이전 1676 CRLF)", () => {
      const buf = readBuffer(
        "apps/web/src/app/dashboard/organizations/[id]/page.tsx",
      );
      expect(countCRLF(buf)).toBe(0);
    });

    it("settings/workspace/page.tsx — CRLF 0 (이전 779 CRLF)", () => {
      const buf = readBuffer("apps/web/src/app/settings/workspace/page.tsx");
      expect(countCRLF(buf)).toBe(0);
    });
  });

  describe("회귀 0 — 핵심 JSX 보존", () => {
    it("organizations/[id]/page.tsx — line 477-480 JSX 구조 보존", () => {
      const src = readFileSync(
        resolve(
          REPO_ROOT,
          "apps/web/src/app/dashboard/organizations/[id]/page.tsx",
        ),
        "utf8",
      );
      // 빌드 fail line 부근 JSX 정상 보존
      expect(src).toMatch(/return \(\s*\n\s*<div className="space-y-6">/);
      expect(src).toMatch(/\{\/\* 헤더 \*\/\}/);
    });

    it("settings/workspace/page.tsx — line 390-393 JSX 구조 보존", () => {
      const src = readFileSync(
        resolve(REPO_ROOT, "apps/web/src/app/settings/workspace/page.tsx"),
        "utf8",
      );
      expect(src).toMatch(/return \(\s*\n\s*<div className="min-h-screen bg-pg">/);
      expect(src).toMatch(/<MainHeader \/>/);
    });

    it("§11.298c ActionMenu shared swap 보존 (organizations)", () => {
      const src = readFileSync(
        resolve(
          REPO_ROOT,
          "apps/web/src/app/dashboard/organizations/[id]/page.tsx",
        ),
        "utf8",
      );
      expect(src).toMatch(/§11\.298c/);
      expect(src).toMatch(/<ActionMenu/);
      expect(src).toMatch(/openMemberActionId/);
    });

    it("§11.298 plain dropdown swap 보존 (settings/workspace)", () => {
      const src = readFileSync(
        resolve(REPO_ROOT, "apps/web/src/app/settings/workspace/page.tsx"),
        "utf8",
      );
      expect(src).toMatch(/§11\.298/);
    });
  });
});
