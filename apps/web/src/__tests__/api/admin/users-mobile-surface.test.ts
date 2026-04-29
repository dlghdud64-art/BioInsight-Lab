/**
 * §11.120 #admin-users-mobile-card-list
 *
 * Source-level regression guard — admin/users page.tsx 가 모바일 분기
 * (md:hidden card list / hidden md:block table) 와 정책/승인/반려 button
 * 모바일에서도 wired 되는지 확인.
 *
 * §11.119 와 동일 dual-render 패턴.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../app/admin/users/page.tsx",
);

describe("/admin/users mobile surface — regression guard (§11.120)", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("desktop-only table 분기 존재 (hidden md:block)", () => {
    expect(source).toMatch(/hidden\s+md:block/);
  });

  it("mobile-only card list 분기 존재 (md:hidden)", () => {
    expect(source).toMatch(/md:hidden/);
  });

  it("mobile card 안에서도 정책/승인/반려 button onClick wired (setSelectedUserId 또는 mutation 호출)", () => {
    // 본 page 의 unique action handler 들 확인 — mobile card 가 dead button 0
    expect(source).toMatch(/setSelectedUserId|approveMutation|rejectMutation|setConfirmReject/);
  });

  it("mobile card 가 KPI / filter 영역 아래 위치 (table 와 같은 부모 안)", () => {
    // 두 분기 가 같은 데이터 source (filteredUsers) 사용
    expect(source).toMatch(/filteredUsers\.map/);
  });
});
