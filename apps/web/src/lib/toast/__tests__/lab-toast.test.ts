import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const USE_TOAST = "src/hooks/use-toast.ts";
const TOAST = "src/components/ui/toast.tsx";
const TOASTER = "src/components/ui/toaster.tsx";
const LAB = "src/lib/toast/lab-toast.tsx";

/* 🛑 부정 단언은 **주석 제거본**에 건다 (CLAUDE.md §부정 단언).
 *    toaster.tsx L19 이 "amber 금지 · #b45821 은 보류 결정" 을 주석으로 기록하고 있어,
 *    원본에 걸면 **금지 기록 자체가 위반으로 잡힌다.** 그러면 구현자가 주석을 지워 통과시킨다.
 *    조항이 자기 설명을 위반으로 세는 형태 — native-select 가 sentinel 을 세던 것과 같다. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("§action-toast — shadcn 확장(A안)", () => {
  it("동시 3개 (TOAST_LIMIT)", () => {
    expect(read(USE_TOAST)).toMatch(/const TOAST_LIMIT = 3/);
  });
  it("progress 필드 (진행 바)", () => {
    expect(read(USE_TOAST)).toMatch(/progress\?: number/);
  });
  it("variant 5종 + default/destructive 보존", () => {
    /* 🔄 재조준 (2026-08-21) — 옛 축은 default 의 구체 문자열
     *    `default: "border bg-background text-foreground"` 을 통째로 잠갔다.
     *    §global-toast 카드 문법이 좌측 3px 상태 바 구조로 바꿔 그 문자열이 사라졌다.
     *    잠글 것은 **variant 목록이 유지되는가** 이지 각 variant 의 스타일 문자열이 아니다 —
     *    스타일은 카드 문법 채택으로 바뀌는 것이 결정이었다. */
    const src = read(TOAST);
    for (const v of ["success:", "warning:", "error:", "info:", "undo:"]) expect(src).toContain(v);
    expect(src).toMatch(/default:/);
    expect(src).toMatch(/destructive:/);
  });
});

describe("§action-toast — Toaster 렌더(아이콘·progress·닫기 규칙)", () => {
  it("variant별 색 구분 유지 — warning 은 yellow 신호등", () => {
    /* ⛔ 은퇴 + 재조준 (2026-08-21) — **이 단언이 금지된 색을 요구하고 있었다.**
     *    옛 축: expect(src).toMatch(/text-[#b45821]/)  ← muted amber 를 **강제**
     *    그런데 CLAUDE.md L161 은 #b45821 을 "미채택/보류(호영님 2026-07-10 §P6 재결정)" 로
     *    명시한다. 즉 **정책과 sentinel 이 반대 방향으로 잠그고 있었다.**
     *    아무도 못 본 이유: 코드가 sentinel 쪽을 따랐고 그래서 GREEN 이었다.
     *    후보 ⑨(도입 시 기존 자산 배타 충돌 검사)의 실례다 — 대상이 sentinel↔조항이다.
     *
     *    1c1cd95a 가 조항 편으로 정리했다. 이 단언을 그 방향으로 재조준한다.
     *    구조도 바뀌었다: VARIANT_ICON map → variant별 chip 클래스. */
    const src = read(TOASTER);
    expect(src).toMatch(/success:\s*\{[^}]*chip:/);
    expect(src).toMatch(/warning:\s*\{[^}]*chip:[^}]*yellow/);
    expect(src).toMatch(/error:\s*\{[^}]*chip:/);
    // 🛑 역방향 — 금지 색 재유입 0 (조항이 sentinel 을 이긴다)
    expect(stripComments(src)).not.toMatch(/#b45821/i);
    expect(stripComments(src)).not.toMatch(/\b(bg|text|border)-amber-/);
  });
  it("progress bar 유지 · 닫기는 항상 노출 (§global-toast 결정 교체)", () => {
    /* ⛔ 은퇴 (2026-08-21) — (d) 결정 은퇴.
     *    옛 축: const showClose = variant !== "info"  ← info 는 닫기 버튼 없음
     *    8/21 핸드오프가 "✕ 항상(히트 32px)" 으로 교체했다.
     *    🛑 옛 규칙은 dead-end 를 만들 수 있었다 — 자동소멸 없는 info 를 사용자가 못 닫는다.
     *    progress bar 자체는 유지되므로 그 부분은 존치한다. */
    const src = read(TOASTER);
    expect(src).toMatch(/role="progressbar"/);
    // 🛑 역방향 — 닫기를 variant 로 가리는 분기 재유입 0
    expect(src).not.toMatch(/showClose\s*=\s*variant\s*!==/);
  });
});

describe("§action-toast — labToast 헬퍼 규칙", () => {
  it("5 API + 타입별 duration(성공 3초·undo 5초·부분/오류/진행 수동)", () => {
    const src = read(LAB);
    for (const a of ["success:", "partial:", "error:", "undo:", "progress:"]) expect(src).toContain(a);
    expect(src).toMatch(/success: 3000/);
    expect(src).toMatch(/undo: 5000/);
    expect(src).toMatch(/warning: Infinity/);
    expect(src).toMatch(/error: Infinity/);
  });
  it("액션은 dismiss 확보 후 update로 주입(순환 회피) + 최대 2개", () => {
    const src = read(LAB);
    expect(src).toMatch(/t\.update\(\{ id: t\.id, action: actionEls/);
    expect(src).toMatch(/actions\.slice\(0, 2\)/);
  });
  it("progress 는 update/close 반환", () => {
    const src = read(LAB);
    expect(src).toMatch(/update: \(u:/);
    expect(src).toMatch(/close: t\.dismiss/);
  });
});

describe("§global-toast — 크기·정렬 pin (호영님 QA 확정 2026-08-21)", () => {
  /* 배포 QA 실측로 확정된 값을 잠근다 — 4c0bfba7 이전에는 무잠금이었다.
   *    카드 문법(보더·상태 바)은 위 절이 잡고, 여기는 크기·정렬만. */
  it("데스크톱 최소 폭 340", () => {
    expect(read(TOAST)).toContain("sm:min-w-[340px]");
  });
  it("패딩 p-4 · 우측 pr-11 (✕ 공간)", () => {
    expect(read(TOAST)).toMatch(/rounded-\[13px\] border[^"]*bg-white p-4 pr-11/);
  });
  it("✕ 수직 중앙 (top-1\/2 + -translate-y-1\/2)", () => {
    const src = read(TOAST);
    expect(src).toContain("right-1.5 top-1/2");
    expect(src).toContain("-translate-y-1/2");
  });
  it("행 수직 중앙 · 칩 30px 원형", () => {
    const src = read(TOASTER);
    expect(src).toContain('className="flex w-full items-center gap-3"');
    expect(src).toMatch(/h-\[30px\] w-\[30px\] flex-none items-center justify-center rounded-full/);
  });
  it("상태 바 재확인 — 좌측 3px (카드 문법 핵심)", () => {
    expect(read(TOAST)).toMatch(/before:w-\[3px\]/);
  });
});
