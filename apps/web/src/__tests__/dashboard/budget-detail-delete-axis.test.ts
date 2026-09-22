/**
 * §budget-delete-ui + §budget-period-axis — 예산 상세 화면 (2026-09-22)
 *
 * 실측 두 건(prod · Chrome):
 *   ① `DELETE /api/budgets/[id]` 는 RBAC·감사로그까지 갖춰 있는데 **누를 데가 없었다.**
 *      만들 수는 있고 지울 수는 없는 화면이다.
 *   ② 원문 `period:...~2026-12-30` 인 예산이 이 화면에 `2026. 12. 31.` 로 떴다.
 *      `new Date(periodEnd).toLocaleDateString()` 이 Date 를 왕복시켜 하루를 민 것이다.
 *      같은 예산이 대시보드에는 `12.30까지` 로 떠서 **두 화면이 하루 어긋났다**.
 *
 * 🛑 §comment-axis — 존재 단언은 주석 제거본으로 한다. 주석이 대신 매칭되면 코드가 없어도 통과한다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "../_helpers/em-dash-scan";
import { blockAfter } from "../_helpers/block-window";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PAGE = "src/app/dashboard/budget/[id]/page.tsx";
const API = "src/app/api/budgets/[id]/route.ts";
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const code = (rel: string) => stripComments(read(rel));

describe("§budget-delete-ui · 지울 수 있는 화면", () => {
  it("① 상세 화면에 삭제 진입점이 있다 · DELETE 를 실제로 부른다", () => {
    const src = code(PAGE);
    expect(src).toMatch(/method:\s*"DELETE"/);
    expect(src).toMatch(/\/api\/budgets\/\$\{id\}/);
    // 버튼이 핸들러에 연결돼 있다(dead button 0).
    expect(src).toMatch(/onClick=\{\(\) => setDeleteOpen\(true\)\}/);
    expect(src).toMatch(/onConfirm=\{handleDelete\}/);
  });

  it("② 확인은 React 모달이다 · window.confirm 류 0", () => {
    const src = code(PAGE);
    expect(src).toContain("ConfirmDialog");
    // 브라우저 전역 대화상자는 자동 검증을 멈춰 세운다. same-canvas 원칙에도 어긋난다.
    expect(src).not.toMatch(/\bwindow\.(confirm|alert|prompt)\s*\(/);
    expect(src).not.toMatch(/(?<!\w)confirm\s*\(\s*["'`]/);
  });

  it("③ 삭제 실패를 성공처럼 보이지 않는다", () => {
    const fn = blockAfter(code(PAGE), "const handleDelete");
    expect(fn, "handleDelete 를 찾지 못했다").toContain("DELETE");
    // 서버가 거절하면 던지고, destructive 로 사유를 띄운다.
    expect(fn).toMatch(/if\s*\(!res\.ok\)/);
    expect(fn).toMatch(/variant:\s*"destructive"/);
    // 거절인데 목록으로 보내버리면 삭제된 것처럼 보인다 — push 는 성공 경로에만 있다.
    // 🛑 창을 `indexOf("catch")` 로 열면 안 된다 — `res.json().catch(...)` 가 먼저 걸린다.
    //    구문상의 catch 절(`} catch (`)을 경계로 쓴다(4원칙 ②).
    const catchIdx = fn.search(/\}\s*catch\s*\(/);
    expect(catchIdx, "handleDelete 에 catch 절이 없다").toBeGreaterThan(-1);
    const okPath = fn.slice(0, catchIdx);
    expect(okPath).toContain('router.push("/dashboard/budget")');
    expect(fn.slice(catchIdx), "실패 경로에서 목록으로 보낸다").not.toContain('router.push(');
  });

  it("④ 권한 판정은 서버가 한다 · 화면이 버튼을 숨겨 이유를 감추지 않는다", () => {
    const api = code(API);
    expect(api).toMatch(/export async function DELETE/);
    expect(api).toContain("isOrgAdminOrOwner");
    // 화면에는 역할로 버튼을 가리는 분기가 없다(숨기면 왜 안 되는지 알 수 없다).
    expect(code(PAGE)).not.toMatch(/role\s*===\s*["'](OWNER|ADMIN)["']/);
  });
});

describe("§budget-period-axis · 상세 화면도 같은 달력 축", () => {
  it("⑤ 종료일 표시는 달력 날짜 문자열에서 온다 · Date 왕복 0", () => {
    const src = code(PAGE);
    expect(src).toContain("periodEndDate");
    // 🛑 두 토큰이 그 **순서로 있다**는 것만 보면 조건을 뒤집어도 통과한다(실측: J4 프로브 검출력 0).
    //    삼항의 **어느 분기가 무엇을 쓰는지**를 본다.
    const i = src.indexOf("const endStr");
    expect(i, "endStr 를 찾지 못했다").toBeGreaterThan(-1);
    const decl = src.slice(i, src.indexOf(";", src.indexOf("toLocaleDateString", i)) + 1);
    const q = decl.indexOf("?");
    const colon = decl.lastIndexOf(":");
    expect(q, "삼항이 아니다").toBeGreaterThan(-1);
    const cond = decl.slice(0, q);
    const whenPresent = decl.slice(q, colon);
    const whenAbsent = decl.slice(colon);
    // 조건은 "달력 날짜가 있으면" 이다 — 부정이면 우선순위가 뒤집힌다.
    expect(cond).toContain("budget.periodEndDate");
    expect(cond, "조건이 부정돼 왕복이 우선이 된다").not.toMatch(/!\s*budget\.periodEndDate/);
    // 있으면 문자열 그대로, 없을 때만 Date 왕복.
    expect(whenPresent).toContain("periodEndDate");
    expect(whenPresent, "달력 날짜가 있는데도 Date 를 왕복한다").not.toContain("toLocaleDateString");
    expect(whenAbsent).toContain("toLocaleDateString");
  });

  it("⑥ 남은 일수는 대시보드와 **같은 함수**에서 나온다", () => {
    const src = code(PAGE);
    expect(src).toContain("budgetPace(");
    expect(src).toMatch(/remainingDays\s*=\s*b\.periodEndDate[\s\S]{0,120}?budgetPace\(/);
  });

  it("⑦ API 가 달력 날짜를 내려준다 · 화면이 스스로 만들지 않는다", () => {
    const api = code(API);
    expect(api).toContain("endCalendarDate");
    expect(api).toMatch(/periodEndDate:\s*endCalendarDate/);
    // 정본은 resolveBudgetPeriod 하나 — 화면이 period 정규식을 들지 않는다.
    expect(code(PAGE)).not.toMatch(/match\(\/period:/);
  });
});
