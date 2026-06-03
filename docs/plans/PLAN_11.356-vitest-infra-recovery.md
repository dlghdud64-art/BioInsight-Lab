# Implementation Plan: §11.356 — vitest 검증 인프라 복구 (+ release-prep 정합)
- **Status:** ⏳ Pending (실제 실행 = 호영님 환경 / 이 문서 = 명령·순서·검증 가이드)
- **Started:** —
- **Last Updated:** 2026-06-03
- **Priority:** **P1 — 모든 트랙의 검증 전제.** 이것 없이는 전 SPEC의 sentinel 테스트가 "실행 불가".
- **유형:** 인프라 복구 (test runner + 빌드 정합) · 코드 로직 변경 아님
- **Scope:** Medium (4 phase)
> **중요:** vitest install은 단순 `npm install vitest`가 아님. tsc/prisma generate/enum drift가 어긋나 있으면 테스트가 **import 단계에서** 깨짐. 그래서 release-prep 정합을 **함께** 다룬다(따로 하면 vitest가 또 막힘). 이 문서는 명령·순서·검증 기준을 제공하고, **실제 실행은 호영님 LabAxis 환경**에서 한다.
> **Quality Gate 규칙:** 각 phase는 명시된 검증을 통과해야 다음으로. 실패 시 stop. 단 Phase 2의 "테스트 대량 실패"는 정상(여태 실행 불가였으므로) — install 실패와 구분.

---
## ⚠️ 운영 정정 (2026-06-03, 모든 트랙 적용) — "실행 불가" 꼬리표 무효
**확인된 사실:** vitest 는 `apps/web` 에 처음부터 **선언돼 있었다**(`vitest ^3.1.1` + `vitest.config.ts` + `test: vitest run`). "미설치"가 아니었다. (sandbox 는 rollup 네이티브 바이너리 1회 설치만 필요했고, 그 뒤 정상 실행 — 본 세션 §11.352·355b·355b2·355d sentinel 실제 통과.)

**따라서:**
1. 기존 SPEC(§11.335b · §11.336 · §11.337 · §11.346 · §11.347 · §11.349 · §11.350 · §11.351 · §11.355 등)에 박힌 **"vitest 미설치 → 실행 불가, 정적 검증만"** 문구는 **전부 무효(false premise)**. 인용 금지.
2. 그 꼬리표는 "테스트 못 돌리니 정적 검증만 해도 된다"는 **부당한 면죄부**였다. §11.337 부분 누락류는 "못 돌려서"가 아니라 **"안 돌려서"** 놓쳤을 가능성이 높다.
3. **강제 규칙:** 각 트랙 착수/완료 시 **해당 sentinel 을 실제 `vitest run` 으로 실행**해 통과/실패를 판정한다. 정적(readFileSync + regex) 검증은 **보조**일 뿐, 단독으로 "검증 완료"라 적지 않는다.
4. 단 호영님 실제 환경의 out-of-box 실행 여부는 **전체 풀런(Phase 1·2)으로만 확정** — "선언됨 ≠ 모든 환경 즉시 실행".
---
## 1. Overview / 배경
- 그동안 작성된 sentinel 테스트(검색 §11.335b, 견적함 §11.343/§11.351, 감사 6종 §11.337/§11.345 등)가 **전부 "실행 불가"** 상태. vitest 미설치가 원인.
- 동시에 release-prep P1 잔여: **`prisma generate`, enum drift, MutationAuditEvent migration smoke, Batch 10 soft→full_enforce**. vitest만 깔고 이들이 어긋나면 테스트가 import/타입 단계에서 깨짐.
- 목표: **vitest를 설치하고, 모든 sentinel 테스트가 실제로 돌기 시작하는 baseline을 확보.** 이후 "실행 불가" 꼬리표 제거.
## 2. 핵심 원칙
- **이건 인프라 복구지 로직 변경이 아니다.** 테스트가 드러낸 실패를 이 스펙에서 다 고치지 않음 — baseline 확보가 목표. 실제 버그 수정은 각 트랙 SPEC.
- **대량 실패 ≠ install 실패.** 여태 실행 불가였으니 처음엔 빨갛게 뜨는 게 정상. 실패를 "실제 버그 / 테스트 자체 오류 / 환경 정합 문제"로 **분류**하는 게 Phase 2의 일.
- **정적 검증 + 호영님 실행.** 제(Claude)가 명령·기대 결과·검증 기준을 제공, 실제 install/run은 호영님 환경. 결과 회신받아 다음 단계 판단.
- **release-prep과 묶음.** tsc/prisma 정합 없이 vitest 단독 install은 또 막힘.
## 3. Phases
### Phase 0 — 현재 상태 진단 (실행 전 파악)
- Status: [ ] Pending
- **확인 항목:**
  - `package.json` — vitest/vite/tsc 의존성 유무, `test` 스크립트 존재 여부
  - 기존 `vitest.config.*` / `vite.config.*` 유무, test 환경(node/jsdom) 설정
  - prisma: client 생성돼 있는지(`prisma generate` 필요 여부), schema와 migration 동기 여부
  - enum drift 범위 — 코드 enum vs prisma enum vs DB 불일치 목록
  - sentinel 테스트 파일들이 기대하는 import 경로·alias(tsconfig paths)·mock 설정
- **회신 필요(호영님 환경):** `npm ls vitest`, `npx tsc --noEmit` 에러 목록, `npx prisma validate` 결과
- **✋ Gate:** install 전 깨질 지점(타입·prisma·alias) 사전 식별.
### Phase 1 — vitest 설치 + 빌드 정합
- Status: [ ] Pending
- **작업(호영님 실행):**
  - vitest + 필요한 동반 패키지 설치 (`vitest`, 환경에 따라 `@vitest/ui`, jsdom/happy-dom, `@testing-library/*` 등 — Phase 0 결과로 확정)
  - `vitest.config` 작성/정합 (tsconfig paths, 환경, setup 파일)
  - `prisma generate` 실행, schema-migration 동기
  - enum drift 정정 (코드↔prisma↔DB 일치)
  - `tsc --noEmit` 통과(또는 남은 에러 목록화)
- **검증:** `npx vitest --run` 이 **실행은 됨**(통과 아님). import 단계 크래시 없음.
- **✋ Gate:** vitest가 테스트를 **수집·실행 시작**함(결과 빨강이어도 OK). tsc 통과 또는 잔여 에러 명확.
- **Rollback:** package.json/config revert.
### Phase 2 — sentinel 테스트 baseline
- Status: [ ] Pending
- **작업:** 전체 sentinel 테스트 일괄 실행 → 결과 수집.
- **분류(핵심):** 각 실패를 3분류 —
  - **(a) 실제 버그** — 테스트가 옳고 코드가 틀림 → 해당 트랙 SPEC으로
  - **(b) 테스트 자체 오류** — assert/mock이 틀림 → 테스트 수정
  - **(c) 환경 정합** — import/alias/prisma 미정합 → Phase 1로 환류
- **회신 필요:** `npx vitest --run` 전체 출력(통과/실패 수, 실패 테스트명)
- **✋ Gate:** 모든 sentinel이 **수집되어 실행**되고, 실패가 a/b/c로 분류됨. (전부 통과가 목표 아님 — 분류가 목표)
- **Rollback:** N/A (읽기/분류).
### Phase 3 — 정합 마무리 + 트랙 환류
- Status: [ ] Pending
- **작업:**
  - (c) 환경 정합 실패 해소 → 모든 테스트가 "환경 탓"으로 깨지지 않게
  - (b) 테스트 자체 오류 수정 (각 트랙이 기대한 assert가 실제로 도는지)
  - (a) 실제 버그는 **목록화하여 각 트랙 SPEC에 환류** (여기서 안 고침 — scope 분리)
  - release-prep 잔여(MutationAuditEvent migration smoke, Batch 10 soft→full_enforce)는 별도 확인 — 이 스펙 범위 밖이면 목록만
- **검증:** "실행 불가"였던 sentinel이 이제 **통과/실제실패로 명확히 판정**됨.
- **✋ Gate:** 환경 탓 실패 0, 남은 실패는 전부 (a) 실제 버그로 분류·트랙 배정 완료.
- **Rollback:** 단계별 revert.
## 4. Risks
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 대량 실패를 install 실패로 오해 | High | Med | "대량 실패=정상" 명시, a/b/c 분류로 다룸 |
| tsc/prisma 미정합으로 vitest import 크래시 | High | High | release-prep 묶음, Phase 0 사전 식별 |
| enum drift가 광범위 | Med | High | Phase 0에서 drift 목록화, Phase 1 정정 |
| sentinel 테스트 자체가 stale | Med | Med | (b)로 분류해 수정, 트랙별 의도 재확인 |
| Batch 10 enforce 전환과 충돌 | Low | Med | 이 스펙 범위 밖, 목록만 — 별도 처리 |
## 5. Out of Scope
- 테스트가 드러낸 **실제 버그(a) 수정** — 각 트랙 SPEC(§11.335b 등)으로 환류.
- Batch 10 soft→full_enforce 전환 자체 (release-prep 별 항목).
- 새 기능/로직 변경.
## 6. Progress Tracking
- [ ] Phase 0 (진단)
- [ ] Phase 1 (설치 + 정합)
- [ ] Phase 2 (baseline + 분류)
- [ ] Phase 3 (정합 마무리 + 환류)
## 7. 착수 후 효과
- 이후 모든 SPEC의 **"vitest 미설치 → 실행 불가"** 꼬리표 제거.
- "빌드 에러 → 배포 누락" 반복(§11.337 부분 누락 등)의 **근본 원인 해소.**
- §11.350 로딩 fix 포함, 대기열 전 트랙이 실제 테스트로 검증 가능.
## 8. Notes
- 실제 install/run은 호영님 환경. 이 문서는 명령·순서·검증 기준 가이드.
- Phase 0 회신(`tsc --noEmit`, `prisma validate`, `npm ls vitest`) 받으면 Phase 1 명령을 환경에 맞게 구체화.
- (실행 중 기록)

---
## 부록 A — Sandbox Phase 0 진단 결과 (Claude, 2026-06-03)
> sandbox는 이 세션 내내 vitest 를 돌렸음(§11.352·355b·355b2·355d sentinel 통과). 아래는 sandbox 실측 — 호영님 환경 명령 구체화의 기준선.
**실측 (2026-06-03 sandbox):**
- ✅ **vitest 이미 설치됨** — `apps/web` devDeps `vitest ^3.1.1`, `apps/web/vitest.config.ts` 존재, `test` 스크립트 = `vitest run`(root → `cd apps/web && npm run test`). → **계획서 전제("vitest 미설치 → 실행 불가")는 현재 repo에선 거짓.** 이번 세션 내내 sentinel 실행됨.
- ✅ **prisma client 생성됨** (`node_modules/.prisma/client`), `prisma validate` = 스키마 유효(에러 없음, 버전 업그레이드 안내만).
- ✅ sentinel 테스트 파일 **616개** 수집 대상 존재. 오늘 4종(§11.352·355b·355b2·355d) 통과 확인.
- ⚠️ `tsc --noEmit` = 모노repo 규모로 40s+ 소요(타임아웃) — 통과/에러 판정은 호영님 환경에서 시간 두고 확인 필요. (느림 자체는 정상, install 문제 아님.)
- ⚠️ `vsentinel.config.mjs` 루트 잔여물 — 호영님 환경에서 삭제 필요(sandbox 권한 불가).

**재정의된 §11.356 잔여 (전제 수정 후):**
1. install/recovery = **불필요**(이미 됨). 
2. 실질 잔여 = (a) **전체 616 파일 baseline 1회 완주**(호영님 환경, 시간 확보 후 `npm run test` 풀런 → a/b/c 분류), (b) **tsc --noEmit 완주 후 타입 에러 목록화**, (c) release-prep(enum drift·MutationAuditEvent migration·Batch10 enforce)는 별 항목.
3. 즉 §11.356은 "복구"가 아니라 **"전체 suite 1회 완주 + 분류 + tsc 정합"** 으로 축소.
