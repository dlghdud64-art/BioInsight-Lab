# COMMIT — §11.332 설정 dead 항목 정리 (방안 A)

```
fix(settings) §11.332 #settings-dead-cleanup — 미구현 섹션 메뉴 제거(온톨로지/시스템연동) + Cost Center 조건부 (호영님 P2)
```

## 호영님 spec (§11.332 진단 확정 + 방향 결정)
- dead UI 금지(CLAUDE.md). 진단: ⑤ 시스템연동(SAP/Thermo/Sigma/Oracle)=하드코딩 mock 미구현, ⑥ 온톨로지 AI 추론 매개변수=useState only 저장 0, ③ Cost Center/입고위치=표시만(소비처 0).
- 호영님 결정: ⑤⑥ **메뉴 제거**, ③ **조건부 숨김**, ⑧ invoices mock=**별도 mini-fix**(본 batch 제외).

## Fix (file 별)
- `app/dashboard/settings/page.tsx`:
  - NAV_GROUPS 에서 `id:"ontology"`(온톨로지 엔진 AI)·`id:"integrations"`(시스템 연동) 메뉴 항목 제거 → 진입로 0. `activeSection === "ontology"/"integrations"` 블록은 **코드 잔존**(dead 노출 0, rollback=항목 복원).
  - "기본 업무 환경"(Cost Center/입고 위치) 블록: `(userData?.costCenter || userData?.defaultLocation)` 있을 때만 렌더, 각 행도 값 있을 때만. "운영 정책 미설정" dead 신호 제거.
- `__tests__/regression/settings-dead-cleanup-332.test.ts`: sentinel.

## 검증 (vitest 실행)
- settings-dead-cleanup-332 → **6 tests passed**.

## Canonical truth 보존
- 스키마/데이터 영향 0. activeSection 블록·작동 메뉴(operator/security/notifications/billing) 보존.
- ✅ 작동 항목(승인한도·결재선·RBAC·청구) 무변경.

## Production effect
- 설정 좌측 메뉴에서 온톨로지·시스템 연동 사라짐(미구현 mock 노출 차단). Cost Center 미설정 시 블록 미표시("미설정" dead 제거).

## Out of Scope (별도)
- ⑧ invoices MOCK_INVOICES → real Subscription invoices fetch (별도 mini-fix).
- ③ Cost Center 실연결(입력 UI + 소비처 wiring) = 방안 B, 입고위치 기능 SPEC과 묶어 별도.
- 시스템연동 실연동 / 온톨로지 실저장 = 대형 제품 결정.

## ⚠️ 배포 주의
- 2개 파일 한 커밋(settings/page.tsx + 테스트). push 전 `git status` + Vercel green.
- 누적 미푸시: §11.345-B5(safety 4) · quote-generate-pdf-314b(sentinel 정정) · audit-page-mobile-311b · vsentinel.config.mjs 루트 삭제.

## Rollback path
- NAV 항목 2개 복원 + Cost Center 블록 원복. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
