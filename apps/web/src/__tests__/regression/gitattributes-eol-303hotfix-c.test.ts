/**
 * §11.303-hotfix-c #gitattributes-eol — .gitattributes 추가 + LF normalize
 *   강제. CRLF 재발 영구 차단.
 *
 * §11.303-hotfix (2 file CRLF → LF) 후속:
 *   §11.298/§11.298c 의 CRLF 가 §11.303-hotfix 으로 fix 됐지만, 호영님
 *   Windows core.autocrlf=true 환경에서 새 commit 시 CRLF 재발 가능.
 *   .gitattributes 으로 repo level 자동 LF 변환 강제 — Windows 환경
 *   영구 차단.
 *
 * Test scope:
 *   1. .gitattributes file 존재 (repo root)
 *   2. `* text=auto eol=lf` default rule 존재
 *   3. *.tsx / *.ts / *.json strict LF 명시
 *   4. *.bat / *.cmd CRLF 명시 (Windows-specific)
 *   5. binary file 명시 (line ending conversion 제외)
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const GITATTRIBUTES_PATH = resolve(REPO_ROOT, ".gitattributes");

describe("§11.303-hotfix-c — .gitattributes CRLF 재발 영구 차단", () => {
  it("§11.303-hotfix-c trace marker (self-referential sentinel)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.303-hotfix-c/);
  });

  it(".gitattributes file 존재 (repo root)", () => {
    expect(existsSync(GITATTRIBUTES_PATH)).toBe(true);
  });

  describe(".gitattributes 핵심 rule 검증", () => {
    const SRC = existsSync(GITATTRIBUTES_PATH)
      ? readFileSync(GITATTRIBUTES_PATH, "utf8")
      : "";

    it("§11.303-hotfix-c trace 주석 존재", () => {
      expect(SRC).toMatch(/§11\.303-hotfix-c/);
    });

    it('default rule "* text=auto eol=lf" 존재', () => {
      expect(SRC).toMatch(/^\*\s+text=auto eol=lf$/m);
    });

    it("Source extension 별 strict LF — .tsx / .ts / .jsx / .js", () => {
      expect(SRC).toMatch(/^\*\.tsx\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.ts\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.jsx\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.js\s+text eol=lf$/m);
    });

    it("Config extension strict LF — .json / .md / .yaml / .prisma", () => {
      expect(SRC).toMatch(/^\*\.json\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.md\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.yaml\s+text eol=lf$/m);
      expect(SRC).toMatch(/^\*\.prisma\s+text eol=lf$/m);
    });

    it("Windows-specific scripts CRLF — .bat / .cmd / .ps1", () => {
      expect(SRC).toMatch(/^\*\.bat\s+text eol=crlf$/m);
      expect(SRC).toMatch(/^\*\.cmd\s+text eol=crlf$/m);
      expect(SRC).toMatch(/^\*\.ps1\s+text eol=crlf$/m);
    });

    it("Binary file 명시 — image / font / archive", () => {
      expect(SRC).toMatch(/^\*\.png\s+binary$/m);
      expect(SRC).toMatch(/^\*\.woff2\s+binary$/m);
      expect(SRC).toMatch(/^\*\.pdf\s+binary$/m);
    });
  });
});
