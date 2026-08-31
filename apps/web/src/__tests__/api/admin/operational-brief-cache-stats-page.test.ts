/**
 * §11.163 #operational-brief-cache-stats-admin-page — **은퇴 (승계 교체)**
 *
 * 이 파일이 잠그던 것: `/dashboard/audit/page.tsx` 의 ADMIN-only "운영 브리핑 캐시
 * 통계" Card (`/api/admin/operational-brief-cache-stats` useQuery + hitRate 등 표시).
 *
 * 왜 내리는가: §11.300 #audit-page-cleanup (호영님 P1 2026-05-24) 이 그 block 을
 * **의도적으로 제거**했다 — 일반 사용자에게 개발 디버깅 화면처럼 보이던 회귀.
 * 캐시 통계 admin route 이전은 §11.300c 로 **보류**됐고, 그 사이 이 파일은
 * "Card 가 있다" 를 계속 단언해 baseline 에서 상시 RED 였다
 * (실측 2026-08-30 · v2 조직관리 트랙 검증 중 발견 · 깨끗한 main 에서도 동일 실패).
 *
 * 역방향 잠금(block 부활 시 RED)은 후계 파일이 소유한다 — 여기서 다시 핀하지 않는다:
 *   src/__tests__/regression/audit-page-cleanup-300.test.ts
 *   ("운영 브리핑 캐시 통계 block 제거" · queryKey 부재)
 *
 * ⚠️ endpoint `/api/admin/operational-brief-cache-stats` 자체는 살아 있다 (page.tsx
 *   :628 주석). 호출자 0 은 §11.300c 보류의 결과이지 dead file 이 아니다 — 이 파일의
 *   은퇴가 endpoint 삭제 근거로 읽히지 않게 여기 적어둔다.
 *
 * 되살리는 조건: §11.300c 가 admin 전용 surface 로 카드를 이전할 때 그 surface 를
 * 새 파일로 잠근다. 이 파일을 되돌리지 않는다.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUCCESSOR = resolve(
  __dirname,
  "../../regression/audit-page-cleanup-300.test.ts",
);

describe("§11.163 은퇴 — 후계 잠금(§11.300) 실재 확인", () => {
  it("audit-page-cleanup-300 이 캐시 통계 block 부재를 잠근다", () => {
    expect(existsSync(SUCCESSOR)).toBe(true);
    const successor = readFileSync(SUCCESSOR, "utf8");
    expect(successor).toMatch(/운영 브리핑 캐시 통계/);
    expect(successor).toMatch(/operational-brief-cache-stats/);
  });
});
