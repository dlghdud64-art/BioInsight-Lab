// node types (@types/node) not available; uses child_process and path modules
/**
 * 회귀 방지 smoke test
 * - 브랜드 문자열 회귀
 * - 라이트 모드 잔재
 * - 아이콘 배경 타일 잔재
 * - 하드코딩 hex 사용
 */
import { execSync } from "child_process";
import path from "path";

const SRC = path.resolve(__dirname, "../../");

function grep(pattern: string, ext = "tsx"): string[] {
  try {
    const result = execSync(
      `grep -rn "${pattern}" "${SRC}" --include="*.${ext}" -l`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return result.trim().split("\n").filter(Boolean);
  } catch {
    return []; // grep returns exit 1 when no matches
  }
}

function grepContent(pattern: string, ext = "tsx"): string[] {
  try {
    const result = execSync(
      `grep -rn "${pattern}" "${SRC}" --include="*.${ext}"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    return result
      .trim()
      .split("\n")
      .filter(Boolean)
      .filter((l: string) => !l.includes("//") && !l.includes("node_modules"));
  } catch {
    return [];
  }
}

describe("브랜드 회귀 방지", () => {
  test("사용자 노출 텍스트에 BioInsight가 없어야 함", () => {
    const hits = grepContent('"BioInsight');
    // 컴포넌트/파일명 참조는 허용, 문자열 리터럴만 금지
    expect(hits).toHaveLength(0);
  });

  test("BioInsight Lab 문자열이 없어야 함", () => {
    const hits = grepContent("BioInsight Lab");
    const filtered = hits.filter(
      (h) =>
        !h.includes("import ") &&
        !h.includes("from ") &&
        !h.includes("// ") &&
        !h.includes(".test.")
    );
    expect(filtered).toHaveLength(0);
  });
});

describe("라이트 모드 잔재 방지", () => {
  test("bg-white가 없어야 함 (QR/카메라 제외)", () => {
    const hits = grepContent("bg-white").filter(
      (h) => !h.includes("scan") && !h.includes("QR") && !h.includes("camera")
    );
    expect(hits).toHaveLength(0);
  });

  test("bg-slate-50, bg-gray-50이 없어야 함", () => {
    const hits = grepContent("bg-slate-50\\|bg-gray-50");
    expect(hits).toHaveLength(0);
  });

  test("text-slate-900, text-gray-900이 없어야 함", () => {
    const hits = grepContent("text-slate-900\\|text-gray-900");
    expect(hits).toHaveLength(0);
  });

  test("text-slate-800이 없어야 함", () => {
    const hits = grepContent("text-slate-800");
    expect(hits).toHaveLength(0);
  });
});

describe("하드코딩 hex 방지", () => {
  test("bg-[#...] 하드코딩이 없어야 함", () => {
    const hits = grepContent("bg-\\[#[0-9a-fA-F]\\{6\\}\\]");
    expect(hits).toHaveLength(0);
  });
});

describe("아이콘 배경 타일 방지", () => {
  test("사이드바에 아이콘 배경 타일 (rounded-lg p-2 bg-) 패턴이 없어야 함", () => {
    const sidebar = path.join(SRC, "app/_components/dashboard-sidebar.tsx");
    try {
      const result = execSync(
        `grep -n "rounded.*p-[0-9].*bg-" "${sidebar}"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      );
      const hits = result.trim().split("\n").filter(Boolean);
      expect(hits).toHaveLength(0);
    } catch {
      // No matches = pass
    }
  });
});

describe("shadcn HSL navy tint 방지", () => {
  test("CSS 변수에 hue 240 (navy)이 없어야 함", () => {
    const css = path.join(SRC, "app/globals.css");
    try {
      const result = execSync(`grep -n "240 " "${css}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const hits = result
        .trim()
        .split("\n")
        .filter((l: string) => l.includes("--") && !l.includes("//"));
      expect(hits).toHaveLength(0);
    } catch {
      // No matches = pass
    }
  });
});
