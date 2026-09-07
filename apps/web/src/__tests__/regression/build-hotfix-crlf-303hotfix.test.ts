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
      /* 승계 (§org-management-web P6 2026-08-25 · 표현만 완화):
       * 이 단언이 잠그는 결정은 "SWC nested-generic 회피 후 JSX return 구조가 살아있다" 이지
       * className 문자열이 아니다. P6 가 §dashboard-padding-unify 누락분(좌우 여백 0)을
       * 봉합하며 같은 div 에 패딩 래퍼를 얹고 근거 주석을 넣었을 뿐, 구조는 무손상이다.
       * → return ( 과 <div 사이 주석 1개를 허용하고, className 은 space-y-6 포함으로 핀한다.
       *   주석 본문은 부정 선읽기로 첫 닫힘에서 끊어 창을 넘지 못하게 한다. */
      expect(src).toMatch(/return \(\n(?:\s*\/\*(?:(?!\*\/)[\s\S])*?\*\/\n)?\s*<div className="[^"\n]*\bspace-y-6\b[^"\n]*">\n/);
      expect(src).toMatch(/\{\/\* 헤더 \*\/\}/);
    });

    it("settings/workspace/page.tsx — line 390-393 JSX 구조 보존", () => {
      const src = readFileSync(
        resolve(REPO_ROOT, "apps/web/src/app/settings/workspace/page.tsx"),
        "utf8",
      );
      expect(src).toMatch(/return \(\s*\n\s*<div className="min-h-screen bg-pg">/);

      /* 🛑 은퇴 (호영님 2026-09-07 승인, (가)) — 여기 있던 단언:
       *      expect(src).toMatch(/<MainHeader \/>/);
       *
       *   왜 지웠나: 이 블록의 목적은 `tr -d '\r'` 이 JSX 를 훼손하지 않았다는
       *   **1회성 검증**이었다. 당시 존재하던 마커를 증거로 핀한 것이지,
       *   "이 페이지는 MainHeader 를 쓴다" 가 계약이었던 적은 없다.
       *   2026-09-07 §dashboard-header-swap 이 정당하게 DashboardHeader 로 교체하자
       *   RED 가 됐고, 하루 동안 게이트가 단서를 달고 돌았다.
       *
       *   🛑 이름을 핀했기 때문에 생긴 일이다. §11.303-hotfix 의 durable 명제는
       *   **"이 파일들에 CRLF 가 0이다"** 이고, 그건 위 `CRLF 0 회귀 차단` 블록이
       *   지키며 GREEN 이다(원 사고: 79780f1d — CRLF 가 SWC 파서를 깨 Vercel 배포
       *   20회 연속 ERROR). 레이아웃과는 무관하다.
       *
       *   🔑 대신 지킬 가치가 있는 명제("한 페이지가 마케팅 레이아웃과 대시보드 레이아웃을
       *   동시에 렌더하면 안 된다")는 이 파일에 이식하지 않고 자기 이름으로 분리했다 —
       *   `regression/page-shell-single-source.test.ts`. 이름 아래 다른 것을 지키게 하면
       *   다음 사람이 오독한다(오늘 우리가 그 오독의 피해자였다). */
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
