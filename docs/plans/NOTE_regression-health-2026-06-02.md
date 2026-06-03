# NOTE — 회귀 sentinel 헬스 점검 (2026-06-02)

## 실행 개요
- `src/__tests__/regression/*.test.ts` 159개를 sandbox vitest(최소 config)로 1회 실행.
- 결과: **Test Files 40 failed / 119 passed (159)**, Tests 70 failed / 1604 passed (1674).
- **transform/NUL("Unexpected end of file") 오류 0건** — 빌드를 깨는 구조 문제 없음.

## ⚠️ sandbox 마운트 신뢰성 한계 (중요)
- Edit/Write 도구는 **host(C:\Users\young\ai-biocompare)** 에 기록. bash/vitest 는 **sandbox 마운트** 를 읽음.
- 편집 직후 마운트가 host 를 불안정하게 미러링 → 일시적 **NUL 패딩 / truncation** 아티팩트 관측됨
  (311b "NUL", quote-generate-pdf-314b "Expected ) EOF"). **host 파일(Read 도구)·Vercel 빌드는 정상.**
- ⇒ **방금 편집한 파일의 sandbox vitest 결과는 신뢰 불가.** 권위 있는 검증:
  1) Vercel `next build`(host 커밋 대상 — 오늘 푸시분 전부 READY)
  2) CEO 환경(Claude Code/local)의 `npm test`.

## 실패 40 파일 분류 (표본 진단)
- **오늘 변경이 깬 것 = 1건만**: `quote-generate-pdf-314b` 의 `eventType: "SETTINGS_CHANGED"` 단언
  → §11.345-B 에서 의도적으로 `DATA_EXPORTED` 로 재분류. **본 노트와 함께 sentinel 갱신함.**
- **선재 drift(오늘 미변경 코드 guard)**: 대다수. 예시 —
  - `quote-generate-pdf-314b` 의 `doc.font("Helvetica")` (PDF generator, 미변경 — fallback 제거됨)
  - `quote-drawer-qty-339` (§11.339 v2 에서 제거된 옛 하단 드로어 매핑 guard)
  - `sourcing-triage-removal-292` (page.tsx 주석에 남은 "SOURCING RESULT TRIAGE" 문자열)
  - smart-receiving-*(×4), pricing-plan-credit-removal-303, header-smart-receiving-*, reorder-*,
    receiving-packsize-*, inventory-*, dashboard-eyebrow-*, activity-logs-*, enterprise-info-* 등
    — 오늘 트랙과 무관한 기능들의 sentinel. 이전 세션 기능 변경 시 sentinel 미갱신 추정.

## 권고
- **오늘 작업 검증**: Vercel READY(완료) + CEO 환경 vitest 로 재확인.
- **선재 drift(~39 파일)**: 별도 "sentinel 부채 정리" 트랙으로. 각 sentinel 이 (a) 의도된 변경 미반영인지
  (b) 실제 회귀인지 1건씩 판정 필요 — 오늘 트랙(검색/견적함/감사) 범위 밖이라 일괄 수정 금지.
- sandbox 에서 파일 편집 후 검증은 **줄이는 전체 덮어쓰기 회피(Edit 우선)** + 결과는 host/Vercel 로 교차확인.
