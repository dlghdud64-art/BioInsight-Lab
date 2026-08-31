/**
 * §11.172 #operational-brief-injection-audit-search-filter — **은퇴 (승계 교체)**
 *
 * 이 파일이 잠그던 것: `/dashboard/audit/page.tsx` 의 ADMIN-only "Injection 시도"
 * quick filter chip (search="prompt_injection_detected" + eventTypeFilter 자동 설정).
 *
 * 왜 내리는가: §11.300 #audit-page-cleanup (호영님 P1 2026-05-24) 이 그 chip 을
 * **의도적으로 제거**했다 — 일반 사용자에게 개발 디버깅 화면처럼 보이던 회귀.
 * 제거 후에도 이 파일은 "chip 이 있다" 를 계속 단언해 baseline 에서 상시 RED 였다
 * (실측 2026-08-30 · v2 조직관리 트랙 검증 중 발견 · 깨끗한 main 에서도 동일 실패).
 * 옛 결정을 긍정으로 잠근 파일이 새 결정 뒤에 남으면 그것은 회귀 가드가 아니라
 * **소음**이다 — 누가 봐도 RED 인 테스트는 다음 진짜 RED 를 가린다.
 *
 * 역방향 잠금(chip 부활 시 RED)은 후계 파일이 소유한다 — 여기서 다시 핀하지 않는다:
 *   src/__tests__/regression/audit-page-cleanup-300.test.ts
 *   ("Injection 시도 quick filter chip 제거 (라벨 + magic string 부재)")
 *
 * 이 파일에 남기는 단언은 하나 — **후계 잠금이 실재하는가**. 후계가 지워지면 여기서
 * 소리가 난다(은퇴만 하면 새 결정이 무잠금이 되는 경로 차단).
 *
 * 되살리는 조건: 보안 quick filter 가 admin 전용 surface(§11.300c 보류 트랙)로 이전될 때
 * 그 surface 를 새 파일로 잠근다. 이 파일을 되돌리지 않는다.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUCCESSOR = resolve(
  __dirname,
  "../../regression/audit-page-cleanup-300.test.ts",
);

describe("§11.172 은퇴 — 후계 잠금(§11.300) 실재 확인", () => {
  it("audit-page-cleanup-300 이 Injection chip 부재를 잠근다", () => {
    expect(existsSync(SUCCESSOR)).toBe(true);
    const successor = readFileSync(SUCCESSOR, "utf8");
    expect(successor).toMatch(/not\.toMatch\(\/Injection 시도\/\)/);
  });
});
