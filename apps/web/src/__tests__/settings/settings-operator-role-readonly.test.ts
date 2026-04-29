/**
 * §11.157 #settings-operator-role-readonly-cleanup
 *
 * Source-level regression guard — Settings page 의 operatorRole free-text Input
 * 제거 + canonical role display 보존 검증.
 *
 * Identity Governance 정합:
 *   - profileName / profilePhone / profileEmail 는 user-editable (개인 프로필).
 *   - operationalRole / RBAC / 권한은 user 가 자유 입력 0 (system assigned).
 *
 * §11.74 read-only 영역 (line ~660 SectionCard "운영 역할 및 업무 범위") 와
 * 같은 페이지 안에서 line 633 free-text Input 의 정합 위반을 차단한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../app/dashboard/settings/page.tsx",
);

describe("§11.157 settings operator role read-only cleanup", () => {
  const source = readFileSync(PATH, "utf8");

  it("setOperatorRole setter 부재 (state setter 제거)", () => {
    expect(source).not.toMatch(/setOperatorRole/);
  });

  it("operatorRole useState 부재", () => {
    expect(source).not.toMatch(/const\s+\[operatorRole\s*,/);
  });

  it("\"직책 / 역할\" editable Input 부재", () => {
    // FieldBlock label="직책 / 역할" 자체 또는 그 안의 onChange Input 부재
    expect(source).not.toMatch(/FieldBlock\s+label="직책\s*\/\s*역할"/);
  });

  it("canonical role display 보존 — roleLabel + ROLE_LABELS 매핑 유지", () => {
    expect(source).toMatch(/roleLabel/);
    expect(source).toMatch(/ROLE_LABELS/);
  });

  it("session.user.role 기반 canonical role badge 보존", () => {
    expect(source).toMatch(/session\?\.user\?\.role/);
  });

  it("profile editable fields 보존 (profileName / profilePhone / profileEmail)", () => {
    expect(source).toMatch(/setProfileName/);
    expect(source).toMatch(/setProfilePhone/);
    expect(source).toMatch(/setProfileEmail/);
  });

  it("§11.74 운영 역할 및 업무 범위 SectionCard 보존 (read-only governance area)", () => {
    expect(source).toMatch(/운영 역할 및 업무 범위/);
  });

  it("save payload 가 operatorRole field 를 포함하지 않음 (governance)", () => {
    // updates.operatorRole = ... 또는 mutate({ ..., operatorRole }) 패턴 부재
    expect(source).not.toMatch(/updates\.operatorRole/);
    expect(source).not.toMatch(/operatorRole\s*[:,]/);
  });
});
