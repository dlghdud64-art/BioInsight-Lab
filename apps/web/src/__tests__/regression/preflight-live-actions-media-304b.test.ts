import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const seed = readFileSync(join(WEB_ROOT, "prisma/seed.ts"), "utf8");
const landing = readFileSync(join(WEB_ROOT, "public/bioinsight-lab-os.html"), "utf8");

describe("운영 랜딩 사전 검사", () => {
  it("seed 상품은 가짜 미디어 주소를 노출하지 않는다", () => {
    const fakeMediaHost = ["via", "place" + "holder", "com"].join(".");
    expect(seed).not.toContain(fakeMediaHost);
    expect(seed).toMatch(/imageUrl:\s*null/);
    expect(seed).toMatch(/msdsUrl:\s*null/);
  });

  it("랜딩 조작 요소는 실제 이동 경로를 가진다", () => {
    const emptyAnchor = "href=" + '"' + "#" + '"';
    expect(landing).not.toContain(emptyAnchor);
    expect(landing).not.toMatch(/<button\b/);
    expect(landing).toMatch(/href="\/auth\/signin"/);
    expect(landing).toMatch(/href="\/pricing"/);
    expect(landing).toMatch(/href="\/search"/);
  });

  it("랜딩은 운영 의사결정 흐름을 바로 설명한다", () => {
    expect(landing).toMatch(/연구소 조달 운영 OS/);
    expect(landing).toMatch(/검색 · 비교 · 요청 · 승인/);
    expect(landing).toMatch(/최종 결정은 사용자가 수행합니다/);
  });
});
