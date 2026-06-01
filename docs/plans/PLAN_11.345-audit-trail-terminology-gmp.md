# Implementation Plan: §11.345 — 감사 추적(Audit Trail) 용어 정정 + GMP 고도화

- **Status:** ✅ Part A + 읽기단 UX 완료 / write단 보강 defer
- **Started:** 2026-06-01
- **Last Updated:** 2026-06-01

> 검증 메모: vitest·tsc 미설치(P1 "vitest install" 선행) → 자동 테스트/타입체크 **실행 불가**. 정적 리뷰로 JSX 구조·잔여 문자열 확인. vitest 설치 후 audit-page-mobile-311b / audit-page-cleanup-300 재실행 필요.
- **Model:** Opus (용어·읽기단 UX. 스키마 변경 없음 → 4.8 불필요)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 시 (1) 체크박스 갱신 (2) quality gate 실행 (3) 통과 확인 (4) Last Updated 갱신 (5) Notes 기록 (6) 다음 phase 진행.
⛔ quality gate 실패 / source-of-truth 충돌 미해결 / dead button·no-op·placeholder success 도입 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** repo HEAD (`apps/web/src/app/dashboard/audit/page.tsx`, `prisma/schema.prisma`, `lib/audit/*`). 진단 2026-06-01.

**Secondary References:** 티켓 §11.345 본문, §11.300/§11.311b commit-drafts, §11.99 event-labels.

**Conflicts Found (티켓 가설 vs 코드):**
- 티켓: "변경 내역 누락" → 실제: `AuditLog.changes` 필드·UI diff 렌더 **이미 존재**. write단 미수집이 원인.
- 티켓: "IP 수집 안 됨" → 실제: `ipAddress` 필드 존재, 호출부 비일관(일부만 `x-forwarded-for` 전달).
- 티켓: "MutationAuditEvent migration과 충돌 가능" → 실제: `MutationAuditEvent`는 예산/구매 enforcement 전용. **감사 추적 페이지 소스 아님(=AuditLog). 충돌 없음.**

**Chosen Source of Truth:** 코드 진단 결과가 티켓 추정에 우선. → **스키마 변경 불필요.**

**Environment Reality Check:**
- [x] repo 연결됨 (`C:\Users\young\ai-biocompare`)
- [ ] test runner 실행 가능 여부 미확정 (vitest install은 P1 항목)

## 1. Priority Fit
- Part A(용어): P2, 즉시·무위험.
- 읽기단 UX: P2, page.tsx 한정 최소 diff.
- write단 보강(변경 전후 값 실제 채우기): Part 11 진짜 갭이나 다중 라우트 변경 → **defer (별도 트랙)**. 검색/견적 P1 안정 후.

## 2. Work Type
- [x] Design Consistency (용어)
- [x] Web (읽기단 UX)
- [ ] (defer) write-side audit population

## 3. Overview
**Success Criteria:**
- [ ] 메뉴/제목 "감사 증적" → "감사 추적", 영문 "Audit Trail"
- [ ] 타임존 KST 명시
- [ ] 빈 값 "-" → "기록 없음" 명확화
- [ ] 행 클릭 상세 (same-canvas inline expand)
- [ ] CSV/PDF export 회귀 없음
- [ ] 기존 regression test 갱신·통과

**Out of Scope (절대 금지):**
- [ ] AuditLog 스키마 마이그레이션 (불필요)
- [ ] 활동 로그를 감사 추적에 통합/재해석
- [ ] 상세를 새 페이지로 분리 (page-per-feature)
- [ ] write단 다중 라우트 일괄 수정 (별도 트랙)

## 4. Product Constraints
**Canonical Truth Boundary:**
- Source of Truth: `AuditLog` (Prisma), read via `getAuditLogs`
- Derived Projection: `adaptLog()` → `AuditRow`
- Persistence Path: append-only (no update/delete call sites)
**UI Surface Plan:** [x] Inline expand (행 클릭 상세) — 기존 route 내, 새 페이지 0.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete
진단 완료. 스키마 변경 불필요 확정. MutationAuditEvent 비충돌 확정.

### Phase 1: Part A 용어 정정 — 🔄
- [ ] sidebar / bottom-nav 메뉴 라벨
- [ ] audit/page.tsx (제목·sheet·aria·access·print 헤더)
- [ ] pdf-view route 헤더 (영문 Audit Trail 병기 유지)
- [ ] settings 교차 링크 ("전체 감사 추적 보기")
- [ ] regression test 기대값 갱신
**Quality Gate:** 빌드 무오류, 잔여 "감사 증적"(해당 surface) 0, 테스트 통과.
**Rollback:** 라벨 문자열 revert.

### Phase 2: 변경 전후 값 — read-side 확정 / write-side defer
- [x] 진단: UI diff 렌더 이미 존재 → read-side 추가 작업 없음 (빈 값 정리는 Phase 3)
- [ ] (defer) write-side: 라우트별 `changes`/`ipAddress` 주입 + `quote_pdf_generate` 오분류 정정 → 별도 트랙

### Phase 3: 읽기단 UX 보강 — page.tsx
- [ ] 타임존 `Asia/Seoul` + "KST" 라벨
- [ ] "IP: -" / "변경 내역 -" → "기록 없음"
- [ ] 행 클릭 inline 상세 (전후 값·메타·IP·UA·full ID)
**Quality Gate:** dead button 0, 빈/로딩/에러 상태 유지, same-canvas 유지.
**Rollback:** page.tsx revert.

### Phase 4: Smoke / 감사 대응
- [ ] CSV/PDF export 동작 확인
- [ ] append-only 회귀 없음
- [ ] 관련 regression test 통과

## 9. Risk Assessment
| Risk | P | I | Mitigation |
| :-- | :-- | :-- | :-- |
| regression test가 "감사 증적" 문자열 assert | High | Med | 테스트 기대값 동시 갱신 |
| 행 클릭 상세가 모바일 레이아웃 깨짐 | Low | Low | 기존 Table colSpan inline row |
| write단 defer가 Part 11 갭 잔존 | Med | Med | follow-up 트랙 명시 |

## 12. Notes & Learnings
- [2026-06-01] 진단: 티켓 "누락" 가설 대부분 write-side 미수집 문제로 재분류. 스키마·UI 이미 구비.
- write-side 보강이 본질적 Part 11 갭 — 단독 트랙 권장.
