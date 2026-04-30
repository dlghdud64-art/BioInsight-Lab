/**
 * §11.159 #settings-workspace-canonical-fetch
 *
 * Source-level guard — Settings page 의 workspaceName / currencyUnit 가
 * hardcoded mock 이 아닌 canonical Workspace fetch 기반.
 *
 * Hard constraints (audit report §13 Commit 3):
 *   - 신규 endpoint 0 (기존 /api/workspaces 재사용).
 *   - Prisma migration 0.
 *   - Workspace 미동기화 시 명시적 fallback indicator 표시 (UnverifiedDataAsCanonical
 *     위험 차단).
 *   - currency 는 Workspace 모델에 필드 부재 — "KRW (시스템 기본값)" fallback.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../app/dashboard/settings/page.tsx",
);

describe("§11.159 settings workspace canonical fetch", () => {
  const source = readFileSync(PATH, "utf8");

  it("workspaceName useState hardcoded \"제1 바이오 R&D 센터\" 부재", () => {
    expect(source).not.toMatch(/useState\("제1 바이오 R&D 센터"\)/);
  });

  it("/api/workspaces canonical fetch 존재", () => {
    expect(source).toMatch(/\/api\/workspaces/);
  });

  it("workspacesData 또는 workspace fetch React Query 통합", () => {
    expect(source).toMatch(/workspaces.*useQuery|useQuery.*workspaces/i);
  });

  it("workspaceName 값이 canonical fetch 결과 또는 fallback 라벨 기반", () => {
    // (a) workspace 데이터 결과 사용 또는 (b) "데이터 미동기화" 같은 명시적 fallback
    expect(source).toMatch(/workspacesData|workspaces\?\s*\.|"데이터 미동기화"|"미동기화"|"미설정"/);
  });

  it("currencyUnit hardcoded \"KRW (₩)\" 부재 + 명시적 시스템 기본값 라벨", () => {
    expect(source).not.toMatch(/useState\("KRW \(₩\)"\)/);
    // currency canonical source (Workspace.currency) 부재이므로 시스템 기본값 표시
    expect(source).toMatch(/시스템 기본값|기본값/);
  });

  it("§11.157 회귀 0 — operatorRole free-text Input 부재 (직전 cleanup 보존)", () => {
    expect(source).not.toMatch(/setOperatorRole/);
    expect(source).not.toMatch(/FieldBlock\s+label="직책\s*\/\s*역할"/);
  });

  it("기존 settings section (현재 워크스페이스 정보 SectionCard) 보존", () => {
    expect(source).toMatch(/현재 워크스페이스 정보/);
  });

  it("profile editable fields 보존 (profileName / profilePhone / profileEmail)", () => {
    expect(source).toMatch(/setProfileName/);
    expect(source).toMatch(/setProfilePhone/);
    expect(source).toMatch(/setProfileEmail/);
  });
});
