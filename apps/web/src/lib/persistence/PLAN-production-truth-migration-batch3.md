# Implementation Plan: Production Truth Migration Batch 3
- Status: ⏳ Pending
- Started: 2026-04-13
- Last Updated: 2026-04-13

### ⚠️ CRITICAL INSTRUCTIONS
- [ ] Update "Last Updated" date upon any modification.
- [ ] Check off (`[x]`) completed task checkboxes sequentially.
- [ ] Run all Quality Gate validation commands before moving to the next phase.
- [ ] ⛔ DO NOT proceed to the next phase if ANY tests or quality checks fail.
- [ ] Document blockers or learnings in the Notes section immediately.

---

### 1. Overview

**Feature Description:**
sessionStorage 기반 3종 persistence(governance event dedupe, approval baseline, outbound history)를
server-first + sessionStorage-fallback 이중 레이어로 전환한다.

**현재 상태 분석:**
| 도메인 | Server Layer | Client Bridge | API Route | Store 연결 |
|--------|:---:|:---:|:---:|:---:|
| Outbound History | ✅ 완료 | ✅ 완료 | ✅ 완료 | ✅ 완료 |
| Review Queue Draft | ✅ 완료 | ✅ 완료 | ✅ 완료 | ✅ 완료 |
| Approval Baseline | ✅ 완료 | ❌ 없음 | ✅ 완료 | ❌ sessionStorage만 |
| Governance Dedupe | ✅ 완료 | ❌ 없음 | ✅ 완료 | ❌ sessionStorage만 |

**결론: 실제 구현 필요한 것은 2개 도메인의 Client Bridge + Store 연결뿐.**

**Success Criteria:**
- [ ] approval-baseline-client.ts 생성 — write-through(session + server) + server-first read
- [ ] governance-event-dedupe.ts가 server bridge를 통해 서버 dedupe 우선 사용
- [ ] approval-snapshot-store.ts가 client bridge를 통해 server-first load
- [ ] 모든 3종 persistence가 동일 패턴: `server-first read → sessionStorage fallback → async write-through`
- [ ] 기존 테스트 통과 (persistence-candidate-truth.test, dispatch-prep-governance-chain.test)
- [ ] tsc 타입 에러 신규 0건

**Out of Scope (범위 외 - ⚠️ 절대 구현하지 말 것):**
- Supabase Direct Client adapter 구현 (이미 Prisma → PostgreSQL 서버 레이어가 존재)
- Prisma 스키마 변경 (이미 모든 모델 정의 완료)
- API 라우트 변경 (이미 4종 모두 완료)
- 새 UI surface 추가
- outbound-history / review-queue 재구현 (이미 완전 전환됨)

---

### 2. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|:---|:---|:---|
| write-through 패턴 유지 | outbound-history-client.ts와 동일 패턴. sessionStorage 즉시 기록 + server 비동기 | server 장애 시 session 데이터만 남음 (acceptable) |
| server-first read | server에 데이터 있으면 우선 사용, 없으면 sessionStorage fallback | 초기 로드 시 1 RTT 추가 (캐시로 완화) |
| 기존 adapter 구조 유지 | PersistenceAdapter<T> 인터페이스 그대로 — 주입점만 활용 | adapter 인터페이스에 async 미포함 → client bridge가 adapter 외부에서 async 처리 |
| API 라우트 재활용 | /api/governance/approval-baseline, /api/governance/event-dedupe 이미 존재 | 추가 라우트 불필요 |

**Dependencies:**
- Required Before Starting: 없음 (모든 서버 레이어, API 라우트, Prisma 모델 이미 존재)
- External Packages: 없음 (추가 설치 불필요)

**기존 패턴 참조 파일:**
- `outbound-history-client.ts` — 완성된 write-through bridge 패턴의 모범 답안
- `review-queue-client.ts` — 완성된 write-through bridge 패턴의 모범 답안

---

### 3. Global Test Strategy & Quality Standards

**Coverage Requirements:**
- Unit Tests: 기존 persistence-candidate-truth.test.ts 확장
- Integration Tests: client bridge의 server-first → fallback 전환 로직
- tsc: 신규 파일 에러 0건

**검증 전략:**
- InMemoryAdapter 기반 unit test (서버 없이 로직 검증)
- tsc --noEmit 타입 체크
- 기존 테스트 회귀 없음 확인

---

### 4. Implementation Phases

#### Phase 1: Approval Baseline Client Bridge 생성
**Goal:** approval-snapshot-store가 server-first read를 사용하도록 전환

**Tasks:**
- **🔴 RED (Failing Tests First)**
  - [ ] persistence-candidate-truth.test.ts에 approval baseline server bridge 테스트 추가
    - ensure → load 사이클에서 server-first 확인
    - server 실패 시 sessionStorage fallback
    - invalidation 후 서버/세션 양쪽 clear
  - [ ] Verify tests FAIL.
- **🟢 GREEN (Make it Pass)**
  - [ ] `approval-baseline-client.ts` 생성
    - `ensureApprovalSnapshotWithServer(data)` — session 즉시 + server 비동기
    - `getApprovalSnapshotWithServer(poNumber)` — server-first → session fallback
    - `clearApprovalSnapshotWithServer(poNumber)` — 양쪽 clear
  - [ ] `approval-snapshot-store.ts` 수정 — client bridge import 추가
    - `ensureApprovalSnapshot()` 내부에서 `ensureApprovalSnapshotWithServer()` 비동기 호출
    - `getApprovalSnapshot()`은 동기 유지 (adapter 사용) + 별도 async 함수 추가
  - [ ] Verify tests PASS.
- **🔵 REFACTOR**
  - [ ] outbound-history-client.ts와 패턴 일관성 확인
- **✋ Phase 1 Quality Gate**
  - [ ] 기존 + 신규 테스트 타입 체크 통과
  - [ ] tsc --noEmit 신규 에러 0건

#### Phase 2: Governance Dedupe Client Bridge 생성
**Goal:** governance-event-dedupe가 server dedupe를 우선 사용하도록 전환

**Tasks:**
- **🔴 RED (Failing Tests First)**
  - [ ] persistence-candidate-truth.test.ts에 dedupe server bridge 테스트 추가
    - markPublished → shouldPublish 서버 레이어 우선 확인
    - clearDedupeForPo 서버 + 세션 양쪽 clear
    - server 실패 시 sessionStorage fallback
  - [ ] Verify tests FAIL.
- **🟢 GREEN (Make it Pass)**
  - [ ] `governance-event-dedupe-bridge.ts` 생성
    - `shouldPublishWithBridge(poNumber, eventType, signatureKey, ttlMs)` — server-first → local fallback
    - `markPublishedWithBridge(poNumber, eventType, signatureKey)` — local 즉시 + server 비동기
    - `clearDedupeForPoWithBridge(poNumber)` — 양쪽 clear
  - [ ] `governance-event-dedupe.ts` 수정
    - `markPublished()` 내부에서 `markPublishedWithBridge()` 비동기 호출 추가
    - `clearDedupeForPo()` 내부에서 `clearDedupeForPoWithBridge()` 비동기 호출 추가
  - [ ] Verify tests PASS.
- **🔵 REFACTOR**
  - [ ] 3개 client bridge 패턴 일관성 확인 (outbound, approval, dedupe)
- **✋ Phase 2 Quality Gate**
  - [ ] 기존 + 신규 테스트 타입 체크 통과
  - [ ] tsc --noEmit 신규 에러 0건

#### Phase 3: 통합 검증 + Store hydration 강화
**Goal:** 전체 persistence가 server-first로 동작하고, re-entry hydration이 server 데이터를 우선 사용

**Tasks:**
- **🔴 RED (Failing Tests First)**
  - [ ] E2E 시나리오 테스트 추가: 전 도메인 server-first hydration
    - 브라우저 세션 없는 상태에서 server에서 approval baseline load
    - 브라우저 세션 없는 상태에서 server에서 dedupe 상태 확인
  - [ ] Verify tests FAIL.
- **🟢 GREEN (Make it Pass)**
  - [ ] `approval-snapshot-store.ts`에 async hydration 함수 추가
    - `hydrateApprovalSnapshotFromServer(poNumber)` — server-first load → adapter에 캐시
  - [ ] po-created-reentry-surface.tsx / dispatch-prep-workbench.tsx에서 mount 시 server hydration 호출 확인
  - [ ] Verify tests PASS.
- **🔵 REFACTOR**
  - [ ] client bridge 파일들의 import path / naming 일관성 최종 정리
- **✋ Phase 3 Quality Gate**
  - [ ] 전체 테스트 타입 체크 통과
  - [ ] tsc --noEmit 신규 에러 0건
  - [ ] 기존 dispatch-prep-governance-chain.test.ts 회귀 없음

---

### 5. Risk & Rollback Strategy

| Risk | Probability | Impact | Mitigation Strategy |
|:---|:---|:---|:---|
| Prisma DB 미연결 상태 | High (개발 환경) | Low | server 실패 → sessionStorage fallback 자동 전환. db.ts의 Proxy 스텁이 빈 결과 반환. |
| server-first read 지연 | Low | Medium | sessionStorage가 즉시 기록되므로 UI 블로킹 없음. server read는 background hydration. |
| 기존 테스트 깨짐 | Low | High | InMemoryAdapter 기반 테스트 유지. adapter injection으로 격리. |
| approval-snapshot-store 동기 API 변경 | Medium | Medium | 기존 동기 함수 유지 + 별도 async 함수 추가. 호환성 보장. |

**Rollback Plan:**
- Phase 1 실패: approval-baseline-client.ts 삭제, store 원복
- Phase 2 실패: governance-event-dedupe-bridge.ts 삭제, dedupe 원복
- Phase 3 실패: hydration 호출 제거만으로 원복 가능

---

### 6. Notes & Blockers
- **Key Insight:** 서버 레이어(Prisma CRUD), API 라우트, Prisma 모델이 이미 모두 존재함.
  실제로 빠져있는 것은 `client bridge 2종 + store 연결`뿐.
- **패턴 참조:** outbound-history-client.ts가 완성된 모범 답안. 동일 구조를 복제하면 됨.
