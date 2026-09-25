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

  it("①-b 삭제는 csrfFetch 로 보낸다 · raw fetch 변이 0", () => {
    // 🛑 prod 실측 2026-09-24: raw fetch 로 DELETE 를 보내 CSRF 미들웨어가 403 으로 막았다.
    //    ① 은 "DELETE 를 부른다" 만 물었고 **어떻게 보내는지**는 묻지 않았다. 게이트는 전부 통과했다.
    const src = code(PAGE);
    expect(src).toMatch(/csrfFetch\(`\/api\/budgets\/\$\{id\}`,\s*\{\s*method:\s*"DELETE"/);
    // 이 화면의 변이 요청(POST/PUT/PATCH/DELETE)은 raw fetch 로 나가지 않는다.
    const rawMutations = src.match(/(?<![A-Za-z])fetch\([^)]*method:\s*"(POST|PUT|PATCH|DELETE)"/g) ?? [];
    expect(rawMutations, "raw fetch 변이가 남아 있다 · CSRF 에 막힌다").toEqual([]);
  });

  it("② 확인은 React 모달이다 · window.confirm 류 0", () => {
    const src = code(PAGE);
    // 🔁 §budget-detail-redesign (2026-09-25) — ConfirmDialog → TypeToConfirmDialog(이름 입력 확인 · 핸드오프 §1).
    //    명제(React 모달 · 전역 대화상자 0)는 그대로다. 부분 문자열 우연 매칭을 피하려고 여는 태그로 묻는다.
    expect(src).toContain("<TypeToConfirmDialog");
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

  it("⑧ 삭제 모달 문구는 화면에 나가는 UI 문자열이다 · em dash 0", () => {
    // 🛑 실측 2026-09-22: 이 문구에 `—` 를 넣은 채 게이트·빌드·원장을 전부 통과했다.
    //    pre-commit 의 em dash 검사는 **신규 추가 파일만** 본다(.husky/pre-commit:39).
    //    이 파일은 수정(M) 이라 검사를 안 받았다 — 화면을 눌러 보고서야 나왔다.
    const src = code(PAGE);
    // 🔁 §budget-detail-redesign — 모달이 TypeToConfirmDialog 로 바뀌었다. 창의 여는 태그만 옮긴다.
    const i = src.indexOf("<TypeToConfirmDialog");
    expect(i, "TypeToConfirmDialog 를 찾지 못했다").toBeGreaterThan(-1);
    const modal = src.slice(i, src.indexOf("/>", i) + 2);
    expect(modal, "모달 문구에 em dash 가 있다 · 구분자는 · 다").not.toContain("\u2014");
    // 무엇을 지우는지 눈으로 보이게 — 이름과 금액이 문구에 있다.
    expect(modal).toContain("budget.name");
    expect(modal).toContain("formatAmt");
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
    // 🔁 §budget-detail-redesign (2026-09-25) — 판정을 서버로 옮겼다(핸드오프 §4 front-only 금지).
    //    명제는 그대로: 남은 일수·일평균 여유는 budgetPace 에서 나온다. 자리만 화면 → 서버 파생 모듈.
    //    화면은 남은 일수를 **스스로 세지 않는다**(두 번째 계산식이 생기면 축이 다시 갈린다).
    const derive = code("src/lib/budget/budget-detail-derive.ts");
    expect(derive).toMatch(/from "@\/lib\/dashboard\/p0-display"/);
    expect(derive).toMatch(/const pace = budgetPace\(available, localToday, input\.endDate\)/);
    expect(derive).toMatch(/daysLeft = phase === "active" \? pace\.daysLeft/);
    expect(code(API)).toContain("deriveBudgetDetail(");
    const page = code(PAGE);
    expect(page).not.toMatch(/daysLeft\s*=|remainingDays\s*=|budgetPace\(/);
    expect(page).not.toMatch(/getTime\(\)\s*-/);
  });

  it("⑦ API 가 달력 날짜를 내려준다 · 화면이 스스로 만들지 않는다", () => {
    const api = code(API);
    expect(api).toContain("endCalendarDate");
    expect(api).toMatch(/periodEndDate:\s*endCalendarDate/);
    // 정본은 resolveBudgetPeriod 하나 — 화면이 period 정규식을 들지 않는다.
    expect(code(PAGE)).not.toMatch(/match\(\/period:/);
  });
});
