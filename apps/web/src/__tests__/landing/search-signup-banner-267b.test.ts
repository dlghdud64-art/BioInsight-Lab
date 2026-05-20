/**
 * §11.267b #search-signup-banner — 검색 체험 페이지 상단 가입 배너 (호영님 spec)
 *
 * 호영님 spec:
 *   "검색 체험 페이지에는 로그인 유도가 검색 후에만 발생 → 페이지 상단에
 *   '무료 가입하고 비교·견적까지 한 번에 →' 배너 상시 표시. 검색 없이도
 *   회원가입 버튼 접근 가능하도록."
 *
 * Fix (1 신규 banner block at /search/page.tsx 상단):
 *   - logged-out (session?.user === null) 한정 banner 노출
 *   - "무료 가입하고 비교·견적까지 한 번에 →" 라벨
 *   - <Link href="/auth/signin"> 으로 가입/로그인 페이지 직진
 *   - 페이지 상단 (검색 input 위) 배치 — 검색 입력 전에 visible
 *
 * canonical truth lock:
 *   - 기존 search input + 검색 시 로그인 modal 트리거 (handleSearch) 보존
 *   - example queries 보존
 *   - logged-in 분기 (router.push("/app/search?q=...")) 보존
 *   - savePendingAction 보존 (검색 후 로그인 시 검색어 보존)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../app/search/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.267b #1 — search 페이지 상단 가입 배너 신규", () => {
  it("§11.267b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.267b/);
  });

  it("'무료 가입하고 비교·견적까지 한 번에' 배너 텍스트 존재", () => {
    expect(page).toMatch(/무료 가입하고 비교·견적까지 한 번에/);
  });

  it("배너 안 /auth/signin Link 존재", () => {
    expect(page).toMatch(
      /무료 가입하고 비교·견적까지 한 번에[\s\S]{0,800}\/auth\/signin|\/auth\/signin[\s\S]{0,800}무료 가입하고 비교·견적까지 한 번에/,
    );
  });

  it("배너는 logged-out 한정 노출 (!session?.user 조건부 렌더)", () => {
    // 배너 위에 !session?.user 또는 status !== "authenticated" 분기
    expect(page).toMatch(/!session\?\.user[\s\S]{0,500}무료 가입하고|무료 가입하고[\s\S]{0,500}!session\?\.user/);
  });

  it("배너 data-testid 명시 (production smoke verify)", () => {
    expect(page).toMatch(/data-testid="search-signup-banner"/);
  });
});

describe("§11.267b #2 — invariant 보존 (canonical truth)", () => {
  it("handleSearch 보존 (검색 시 로그인 modal 트리거 + savePendingAction)", () => {
    expect(page).toMatch(/handleSearch/);
    expect(page).toMatch(/savePendingAction/);
    expect(page).toMatch(/setShowLoginModal\(true\)/);
  });

  it("logged-in 분기 (router.push 으로 /app/search?q=) 보존", () => {
    expect(page).toMatch(/router\.push\(`\/app\/search\?q=/);
  });

  it("exampleQueries (Anti-GAPDH antibody / DMEM 등) 보존", () => {
    expect(page).toMatch(/exampleQueries/);
    expect(page).toMatch(/Anti-GAPDH antibody/);
  });

  it("useSession 보존", () => {
    expect(page).toMatch(/useSession/);
  });

  it("Search icon import 보존", () => {
    expect(page).toMatch(/Search.*lucide-react/);
  });
});
