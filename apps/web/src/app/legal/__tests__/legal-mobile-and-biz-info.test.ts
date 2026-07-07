import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const LEGAL = "src/app/legal/page.tsx";
const FOOTER = "src/app/_components/main-footer.tsx";

describe("§P-leg-hotfix — 법적고지 모바일 본문 우측 잘림 정정", () => {
  it("920↓ grid track 이 minmax(0,1fr) (auto min 제거)", () => {
    const src = read(LEGAL);
    expect(src).toMatch(/@media \(max-width: 920px\) \{ \.legal-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(src).not.toMatch(/grid-template-columns: 1fr; gap: 20px;/);
  });
  it("grid item(legal-body/toc) min-width:0 — 표 min-width로 셀이 뷰포트 넘치는 것 방지", () => {
    const src = read(LEGAL);
    expect(src).toMatch(/\.legal-toc, \.legal-body \{ min-width: 0; \}/);
  });
  it("본문 긴 요소 overflow-wrap", () => {
    const src = read(LEGAL);
    expect(src).toMatch(/\.legal-prose \{ overflow-wrap: anywhere; \}/);
  });
});

describe("§biz-info — 푸터 사업자 정보 블록(휴업/런칭 시 고지)", () => {
  it("사업자 정보 헤더 + 상호 + 문의", () => {
    const src = read(FOOTER);
    expect(src).toMatch(/사업자 정보/);
    expect(src).toMatch(/상호: LabAxis/);
    expect(src).toMatch(/support@labaxis\.co\.kr/);
  });
  it("전자상거래법 표시사항 = 정식 개시 시 고지 안내(placeholder 아님·정직)", () => {
    const src = read(FOOTER);
    expect(src).toMatch(/전자상거래 등에서의 소비자보호에 관한 법률/);
    expect(src).toMatch(/개시\(런칭\) 시점에 고지/);
  });
});
