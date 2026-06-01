# COMMIT — §11.345 감사 추적 용어 정정 + 읽기단 UX

```
fix(audit) §11.345 #audit-trail-terminology — "감사 증적"→"감사 추적" 용어 정정 + 읽기단 UX(타임존/행 상세/기록 없음) (호영님 P2)
```

## 호영님 spec (§11.345)
- "증적(證跡)"은 비표준 조어. 이 화면 = Audit Trail = GMP/21 CFR Part 11 표준 용어 **"감사 추적"**.
- 메뉴·페이지 제목 정정, 영문 표기 시 "Audit Trail".
- 진단 결과 스키마 변경 불필요 — `AuditLog.changes`/`ipAddress` 필드 및 UI diff 렌더 이미 존재.

## 진단 (Part B, read-only 확정)
- `MutationAuditEvent`(P1)는 예산/구매 enforcement 전용 → 감사 추적 페이지 소스 아님(=`AuditLog`). **충돌 없음, 마이그레이션 0.**
- "변경 내역 -"·"IP -"는 write단 미수집 문제(별도 트랙). UI/스키마는 이미 구비.
- append-only: `auditLog.update`/`delete` 호출 0건 (앱 레벨 불변, DB 트리거 강제는 아님).

## Fix (file 별)
- `_components/dashboard-sidebar.tsx`, `components/layout/bottom-nav-more-sheet.tsx`: 메뉴 라벨 "감사 추적".
- `app/dashboard/audit/page.tsx`: 제목·sheet·aria·접근 안내·print 헤더 "감사 추적". 타임존 `Asia/Seoul`+"KST" 명시. 빈 값 "-"→"기록 없음". 행 클릭 inline 상세(전후 값·메타·IP·UA·full ID·raw JSON + append-only 고지) — same-canvas.
- `api/audit-logs/pdf-view/route.ts`: 출력 헤더 "LabAxis 감사 추적 (Audit Trail)".
- `dashboard/settings/page.tsx`, `settings/plans/page.tsx`, `_components/role-value-section.tsx`, `_components/trust-section.tsx`: 교차 참조/카피 용어 정합.
- `__tests__/regression/audit-page-mobile-311b.test.ts`, `audit-page-cleanup-300.test.ts`: 기대값 "감사 추적"으로 갱신.
- `docs/plans/PLAN_11.345-audit-trail-terminology-gmp.md`: 계획서.

## Canonical truth 보존
- Source of truth `AuditLog` 그대로. 표시/라벨/읽기단만 변경. 스키마·write 경로 무변경.

## Production effect
- 메뉴·페이지·PDF 출력에서 "감사 추적" 노출. 타임존 명확화로 Part 11 정합 ↑. 행 상세로 GMP 단건 검토 용이.

## Out of Scope (별도 트랙)
- write단 `changes`/`ipAddress` 일괄 주입 + `quote_pdf_generate`의 `SETTINGS_CHANGED` 오분류 정정.
- DB 레벨 tamper-proof(트리거/RLS) 강제.

## Rollback path
- 라벨 문자열 revert + page.tsx의 timezone/상세/기록없음 hunk revert. 독립적이라 단독 rollback 가능.

## 검증
- vitest·tsc 미설치 → 자동 테스트 **실행 불가**. 정적 리뷰 완료. 설치 후 위 2개 sentinel 재실행 필요.
```
footer 없음 (Co-Authored-By 미사용)
```
