/**
 * §11.164 #workspace-last-active-tracking
 *
 * Source-level guard — `pickActiveWorkspace()` priority function 추가 +
 * settings page 가 implicit `workspaces[0]` 대신 explicit 함수 호출.
 *
 * Priority logic:
 *   1. (future) session.user.lastWorkspaceId — schema 미존재로 deferred
 *   2. WorkspaceMember.updatedAt desc 첫 번째 (`getUserWorkspaces` endpoint
 *      이미 desc 정렬) — implicit last active.
 *   3. fallback null (workspaces 미동기화 시 §11.159 fallback indicator).
 *
 * §11.142 lock + Identity Governance 정합:
 *   - workspace 선택 결정은 캐논 (User.lastWorkspaceId 또는 Membership 정렬).
 *   - operator 자유 선택 0 (Settings 본 surface 는 read-only).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../app/dashboard/settings/page.tsx",
);

describe("§11.164 active workspace selection — explicit picker", () => {
  const source = readFileSync(PATH, "utf8");

  it("pickActiveWorkspace 함수 또는 명시적 activeWs 선택 logic 존재", () => {
    expect(source).toMatch(/pickActiveWorkspace|activeWorkspace/);
  });

  it("WorkspaceMember.updatedAt desc 기반 implicit last active 명시 주석", () => {
    expect(source).toMatch(/last\s*active|마지막\s*활성|updatedAt\s*desc/i);
  });

  it("workspaces 빈 배열 시 명시적 fallback (\"데이터 미동기화\")", () => {
    expect(source).toMatch(/데이터 미동기화|미동기화/);
  });

  it("회귀 0 (§11.159): /api/workspaces fetch 보존", () => {
    expect(source).toMatch(/\/api\/workspaces/);
    expect(source).toMatch(/settings-workspaces/);
  });

  it("회귀 0 (§11.157): operatorRole free-text Input 부재", () => {
    expect(source).not.toMatch(/setOperatorRole/);
    expect(source).not.toMatch(/FieldBlock\s+label="직책\s*\/\s*역할"/);
  });

  it("회귀 0: 현재 워크스페이스 정보 SectionCard 보존", () => {
    expect(source).toMatch(/현재 워크스페이스 정보/);
  });
});
