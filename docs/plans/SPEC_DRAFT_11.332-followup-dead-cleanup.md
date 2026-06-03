# SPEC 초안: §11.332 후속 — 설정 dead 항목 정리 (숨김 기준)

- **Status:** ✅ 결정 확정 + GREEN 구현 완료 (방안 A — 2026-06-02)
- **Type:** Bugfix / Design Consistency (dead UI 제거)
- **Priority:** P2 (보정: dead button 금지는 원칙상 P1급이나, 설정 dead 항목은 혼란이지 기능 차단/데이터 오염이 아님. 실행 대기열의 실제 P1은 release-prep(vitest·prisma·enum drift)이므로 운영 리스크상 P2.)
- **전제:** §11.332 진단표 확정 결과 기반.
- **결정(호영님 6번):** ⑤⑥=메뉴 제거 / ③=조건부 숨김 / ⑧=별도 mini-fix. 전부 방안 A.
- **구현:** settings/page.tsx 메뉴 항목 2개 제거 + Cost Center 블록 조건부. sentinel `settings-dead-cleanup-332.test.ts`(6 tests passed). 커밋 초안 `COMMIT_11.332-settings-dead-cleanup.md`.

## 0. 진단 결과 요약 (확정)

| # | 영역 | 분류 | 처리 후보 |
| :-- | :-- | :-- | :-- |
| 3 | Cost Center / 입고 위치 | ⚠️ 표시만(소비처 0) | 숨김 or 연결 |
| 5 | 시스템 연동 SAP/Thermo/Sigma/Oracle | ❌ 미구현(하드코딩 mock) | 숨김 |
| 6 | 온톨로지 AI 추론 매개변수 | ❌ 미구현(useState only, 저장 0) | admin 숨김 |

(✅ 작동: 승인한도·결재선·RBAC·청구 — 본 SPEC scope 아님. 단 8번 invoices MOCK_INVOICES는 별도 mini-fix 후보.)

## 1. 구조 (settings/page.tsx, activeSection 기반)

- 섹션 전환 = `activeSection` state. 좌측 메뉴 항목 클릭 → 해당 `{activeSection === "..." && (...)}` 블록 렌더.
- **온톨로지**(1057-): `activeSection === "ontology"` 블록 — SectionCard 2개("AI 추론 매개변수" 1057 / "자동화 규칙" 1085). 메뉴 정의 `id: "ontology"`(page.tsx:133).
- **시스템 연동**(1151-): `activeSection === "integrations"` 블록 — SectionCard "ERP 및 외부 시스템 연동"(1152), 하드코딩 systems 배열(1155-1158).
- **Cost Center**(783-799): 보안/운영자 섹션 안 "기본 업무 환경" 블록(승인 권한 LIMITS 블록 779 인접).

## 2. 처리 방안 (3안, 호영님 택1 — 영역별 다를 수 있음)

### 방안 A — 메뉴 탭 숨김 (가장 안전·minimal-diff, 권장)
- 온톨로지·시스템 연동: 좌측 메뉴 정의에서 해당 항목 제거(또는 admin-only 가드). `activeSection` 블록은 코드 잔존하나 진입로 없음 → dead 노출 0.
- Cost Center: "기본 업무 환경" 블록만 조건부 숨김(`userData?.costCenter || defaultLocation` 있을 때만 렌더, 없으면 블록 자체 제거 — "운영 정책 미설정" 표시 제거).
- 장점: 회귀 최소, rollback = 메뉴 항목 복원. 데이터/스키마 영향 0.

### 방안 B — 연결(구현)
- Cost Center: 입력 UI 추가 + admin approval-policy route(이미 write 가능) 연결 + 입고/발주 생성 시 소비처 wiring. = 중간 작업.
- 시스템 연동/온톨로지: 실연동/실저장 구현 = 대형. **권장 안 함**(별도 제품 결정).

### 방안 C — 명시적 "준비 중" 배지
- dead 대신 "도입 예정/베타" 라벨. 단 CLAUDE.md dead button 원칙상 애매 — 비권장.

## 3. 권장 (sandbox 의견)

- **5·6번 = 방안 A(메뉴 숨김)**. mock/미저장이라 노출 자체가 호영님 우려(dead UI). admin-only 가드보다 **메뉴 제거**가 깔끔.
- **3번 = 방안 A(블록 숨김)**. "운영 정책 미설정" 표시가 dead 신호 → 값 있을 때만 렌더. 추후 B(연결)는 입고 위치 기능 SPEC과 묶어 별도.
- **8번 invoices MOCK** = 별도 mini-fix(real Subscription invoices fetch 전환, 주석엔 이미 의도 명시).

## 4. Phase (방안 A 기준, 결정 후 GREEN)

- **Phase 1 RED**: settings sentinel — 온톨로지/시스템 연동 메뉴 항목 부재(또는 admin 가드) + Cost Center 블록 조건부 + 회귀(승인한도/결재선/RBAC/청구 메뉴 보존).
- **Phase 2 GREEN**: 메뉴 정의 수정 + Cost Center 블록 조건부 렌더.
- **Phase 3 Smoke**: 설정 진입 시 dead 섹션 미노출 + 작동 섹션 정상 + rollback 문서.

## 5. Out of Scope
- 시스템 연동 실구현, 온톨로지 실저장, Cost Center 소비처 wiring(= 방안 B, 별도).
- ✅ 작동 항목 변경.

## 6. 결정 필요 (호영님)
1. 5·6번 = 메뉴 **제거** vs **admin-only 숨김**?
2. 3번 Cost Center = **숨김** vs **연결(B)**?
3. 8번 invoices mock = 본 batch 포함 vs 별도?
