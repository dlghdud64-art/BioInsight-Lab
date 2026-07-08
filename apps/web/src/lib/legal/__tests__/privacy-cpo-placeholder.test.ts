import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const DOCS = "src/lib/legal/legal-docs.tsx";

describe("§legal-cpo — 개인정보 보호책임자 raw placeholder 라이브 노출 제거", () => {
  it("대괄호 placeholder([성명]/[이메일]/[전화번호]/[부서명]) 미노출", () => {
    const src = read(DOCS);
    expect(src).not.toMatch(/CPO: \[성명/);
    expect(src).not.toMatch(/연락처: \[이메일\]/);
    expect(src).not.toMatch(/\[전화번호\]/);
    expect(src).not.toMatch(/\[부서명\]/);
  });

  it("정직 안내(개시 시 지정·공개) + 문의 이메일로 대체", () => {
    const src = read(DOCS);
    expect(src).toMatch(/개인정보 보호책임자는 정식 서비스 개시\(런칭\) 시점에 지정/);
    expect(src).toMatch(/개인정보 관련 문의: support@labaxis\.co\.kr/);
  });
});
