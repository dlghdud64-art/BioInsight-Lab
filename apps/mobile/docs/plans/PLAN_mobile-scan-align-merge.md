# Implementation Plan: 모바일 스캔 정합 글로우 + 다장 캡처 병합 (A+B)

- **Status:** 🔄 In Progress (Phase 1 RED 확정)
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30
- **Estimated Completion:** TBD (기기 QA = operator)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스 갱신
2. 🧪 quality gate 검증 명령 실행 (sandbox RN 런타임 실행 불가 항목은 "실행 불가" 명시)
3. ⚠️ gate 전항목 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 에 learnings 기록
6. ➡️ 그 후에만 다음 phase

⛔ gate 실패/충돌 미해결 상태 진행 금지 · dead button/no-op/placeholder success 금지 · push 는 operator-shell 단독

---

## 0. Truth Reconciliation

**Latest Truth Source (실측 코드, 2026-06-30):**
- `apps/mobile/app/scan.tsx` — 라벨 스캔 화면(VisionCamera, §11.380).
- `apps/mobile/lib/scan/label-lock.ts` — 라이브 lock 상태머신(§11.380 P3). 순수.
- `apps/mobile/lib/ocr/capture-quality.ts` — FrameQuality(웹과 DUPLICATED).
- `apps/web/src/components/inventory/ScanGuideFrame.tsx` — 웹 Vivino glow 원본.
- `apps/web/src/lib/inventory/scan-form-merge.ts` — 웹 `mergeFormData`(fill-empty) 원본.
- `apps/web/src/components/inventory/LabelScannerModal.tsx` — 웹 `aligned` 라이브 산출(canvas getImageData) + `mergeFormData` 호출(merge 플래그).

**Secondary References:**
- `docs/plans/HANDOFF_2026-06-30_scan-match-batch.md` (§5 백로그 1·2).

**Conflicts Found:**
- HANDOFF "웹 alignment glow 를 모바일 카메라에 이식" = 부분 부정확. 모바일은 이미 lock 기반 emerald 가이드프레임 보유(scan.tsx line ~1153). 빠진 것은 Vivino 소프트 글로우 채움 1겹뿐.
- 웹 `aligned` 신호 = canvas 픽셀 정합 메트릭(웹 전용, capture-quality 라이브 평가). 모바일은 getImageData 없음 → **동일 신호 이식 불가**. 모바일 라이브 신호 = `lockState`(frame processor 텍스트 검출, 이미 계산됨).
- 웹 `mergeFormData` 는 `SmartReceiveFormData` 형. 모바일은 `LabelForm` 형 → **1:1 재사용 불가**, 병렬 구현 필요.

**Chosen Source of Truth:**
- 실측 코드 > HANDOFF 문구.
- A = 웹 픽셀정합 이식 아님. **기존 모바일 `lockState` 에 Vivino 글로우 비주얼 1겹만 추가.**
- B = 모바일 `LabelForm` 전용 fill-empty 병합 util 신설 + 누적 재촬영 경로 신설.

**Environment Reality Check:**
- [ ] repo/branch: `main`, sandbox local read-only.
- [ ] runnable: vitest sentinel(readFileSync+regex) sandbox 가능. tsc 가능.
- [ ] 실행 불가: RN 런타임/빌드/기기 스캔 = sandbox 불가 → operator/기기 QA.

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [x] P2 / Deferred

**Why:** HANDOFF §5 백로그. P1/blocker 아님. 현장(모바일) 스캔 UX 폴리시 — catalogNo 현장 누적 확보(매칭 root cause 보완) + 검출 체감 향상.

## 2. Work Type

- [x] Mobile
- [ ] Feature(웹) / Bugfix / API Slimming / Workflow / Migration / Billing / Web / Design Consistency
- (단일 화면 scan.tsx + 순수 util 1 + 테스트)

## 3. Overview

**Feature Description:**
- A: label-capture 가이드프레임에 비차단 Vivino 글로우(translucent emerald ring+fill) 1겹 추가. `lockState==="locked"` 바인딩. 현장 검출 체감 향상.
- B: 다장 캡처 fill-empty 병합. "다른 각도 재촬영(누적)" 경로 신설 — 곡면 병 catalogNo 가 한 각도에서만 읽혀도 누적 보완. 채워진/dirty 값 보존.

**Success Criteria:**
- [ ] 검출(locked) 시 가이드프레임 안에 비차단 emerald 글로우 노출, 비검출 시 미노출.
- [ ] 글로우가 촬영/버튼/verdict 동작에 무간섭(pointer-events 없음, 게이팅 아님).
- [ ] "다른 각도 재촬영(누적)" → 다음 스캔이 빈 필드만 채우고 기존값 보존.
- [ ] 기존 "재촬영(전체 초기화)" 경로 잔존.
- [ ] §11.340 source 배지(라벨스캔확인 vs 수기) 병합 후에도 정확.

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 웹 canvas 픽셀 정합 메트릭의 모바일 프레임-프로세서 이식(별 트랙, 본 계획 외).
- [ ] verdict/자동촬영/촬영 게이팅 변경(§11.375 보존).
- [ ] canonical(db.product) 변경 — draft 병합만.
- [ ] 신규 페이지/모달.

**User-Facing Outcome:**
- 라벨 검출 순간 프레임 안이 은은하게 emerald 로 차오름(촬영 타이밍 직관). 여러 각도로 추가 촬영해도 먼저 읽힌 catalogNo/Lot 가 사라지지 않고 누적.

## 4. Product Constraints

**Must Preserve:**
- [ ] same-canvas (scan.tsx 단일 화면)
- [ ] canonical truth (draft 병합, db 무접촉)
- [ ] §11.375 경계 (lock≠verdict, glow=advisory)
- [ ] §11.340 source 추적

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant 재해석
- [ ] dead button / no-op / placeholder success
- [ ] preview/lock 가 verdict 덮기

**Canonical Truth Boundary:**
- Source of Truth: `db.product` (서버) / 입고 commit.
- Derived Projection: OCR `parsed` → `LabelForm`.
- Snapshot/Preview: 누적 draft `labelForm`(병합 대상). glow = 라이브 lock 신호.
- Persistence Path: 입고 commit 시점만(본 계획 무변경).

**UI Surface Plan:**
- [x] Existing route section (scan.tsx label-capture / label-review)
- 신규 페이지 0.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 글로우를 `lockState` 에 바인딩(웹 픽셀정합 미이식) | 모바일 getImageData 부재·기존 라이브 신호 재사용·perf 0 추가 | 웹과 신호 출처 상이(정합도≠텍스트검출) — 정직 표기 |
| `LabelForm` 전용 `mergeLabelForm` 순수 util 신설 | 웹 util 과 타입 상이·shared 추출은 별 작업 | 웹/모바일 병합 로직 중복(capture-quality 와 동일 상황) |
| 누적 재촬영 = `handleCaptureLabel(merge)` 플래그 | 기존 전체초기화 재촬영 보존 + 누적 경로 추가 | call-site 시그니처 변경 → pin sweep 필요 |

**Dependencies:**
- Required Before Starting: 없음.
- External Packages: 없음 (공유 node_modules 설치 금지).
- Touched: `apps/mobile/app/scan.tsx`, `apps/mobile/lib/inventory/merge-label-form.ts`(신규), 모바일 sentinel 테스트.

**Integration Points:**
- `handleCaptureLabel`(scan.tsx ~327) — merge 플래그.
- `setLabelForm`(~352) — 병합 분기.
- `resetToScan`(~181/793) — 전체초기화(보존).
- label-review 액션 영역(~789) — 누적 재촬영 CTA.

## 6. Global Test Strategy

- Business logic(`mergeLabelForm`) → 단위테스트(vitest) 필수.
- UI wiring → sentinel(readFileSync+regex) — glow View·바인딩·CTA·source flag 보존·회귀 0.
- RN E2E/런타임 → sandbox **실행 불가** 명시. 기기 smoke = operator.

**Execution Notes:**
- vitest/tsc sandbox 가능. RN build/device 실행 불가 처리. 미실행을 통과로 위장 금지.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** truth/신호/우선순위/contract 확정.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 충돌(HANDOFF vs 실측) 식별 — 위 §0 기록.
**🟢 GREEN:** A=lockState 바인딩, B=draft 병합 확정. call-site 목록 확정.
**🔵 REFACTOR:** scope 축소 — 웹 픽셀정합 이식 제외(별 트랙).

**✋ Quality Gate:** 충돌 0 미해결, 가정 0 허위, priority 기록.
**Rollback:** planning-only.

### Phase 1: Contract & Failing Sentinels
**Goal:** 의도 동작을 실패 테스트로 가시화.
- Status: [ ] Pending | [ ] In Progress | [x] Complete
- 산출: `apps/web/src/__tests__/regression/mobile-scan-align-merge.test.ts`
- RED 증거(static): 신규 마커 5종 부재(`§scan-mobile-align-glow`·`§scan-mobile-multi-merge`·`mergeLabelForm`·`다른 각도 재촬영`·`bg-emerald-400/10`), util 파일 미존재 → import 실패. 회귀 7종 보존(재촬영·resetToScan·setLotScanFilled·setExpiryScanFilled·evaluateLabelCommitGate·lockState·stepLock).
- vitest **실행 불가**(sandbox rollup linux native 부재 + 공유 node_modules 설치 금지) → operator 환경 검증. RED 는 static 으로 확정.

**🔴 RED:** sentinel 작성(현재 실패):
- A: scan.tsx 에 `data-`/className glow(translucent emerald ring+fill) View + `isLocked` 바인딩 매칭.
- B: `merge-label-form.ts` export `mergeLabelForm` 존재. scan.tsx 누적 재촬영 CTA + `handleCaptureLabel` merge 분기 매칭.
- 회귀 0: 기존 "재촬영"(전체초기화) 잔존, §11.340 source flag setter 잔존, §11.375 verdict 무변경.
**🟢 GREEN:** 최소 스캐폴딩으로 컴파일.
**🔵 REFACTOR:** 네이밍 정리.

**✋ Quality Gate:** 실패 테스트 real, 기존 테스트 통과, tsc 문서화.
**Rollback:** sentinel/scaffold revert.

### Phase 2: Core — mergeLabelForm
**Goal:** fill-empty 병합 순수 util.
- Status: [ ] Pending | [ ] In Progress | [x] Complete
- 산출: `apps/mobile/lib/inventory/merge-label-form.ts` — `LabelForm` 타입 + `mergeLabelForm(prev, incoming)`.
- static 검증: export 2종 확인, scan.tsx LabelForm 과 필드 diff 0(완전정합), 로직=웹 mergeFormData 동일(fill-empty·trim·불변·received 보존).
- 단위테스트 6종 = Phase 1 sentinel(vitest 실행 불가→operator GREEN 검증).

**🔴 RED:** 단위테스트 — 빈 필드만 채움 / 채워진값 보존 / dirty 보존 / received 기본값 보존 / source flag 동기화(빈→채움 시 scanFilled true, 기존 채움 유지).
**🟢 GREEN:** `mergeLabelForm(prev, incoming)` 구현.
**🔵 REFACTOR:** 웹 `mergeFormData` 패턴 정합(주석에 중복 사유 명시).

**✋ Quality Gate:** util 테스트 통과, truth-boundary 무위반, overfetch 무.
**Rollback:** util 파일 삭제.

### Phase 3: UI Wiring
**Goal:** 동작 로직을 화면에 연결.
- Status: [ ] Pending | [ ] In Progress | [x] Complete
- 산출(scan.tsx): (A) 가이드프레임 비차단 emerald 글로우(`§scan-mobile-align-glow`, pointerEvents none, isLocked 바인딩). (B) `LabelForm` import(util 단일출처), `labelFormRef`+`accumulate` state, `handleCaptureLabel(merge=false)` + 결과 `mergeLabelForm` 병합, §11.340 source flag 빈필드 한정 갱신, label-review "다른 각도 재촬영(빈 항목 채우기)" CTA(폼 유지 카메라 복귀), FAB `onPress={()=>handleCaptureLabel(accumulate)}`.
- call-site pin sweep: `handleCaptureLabel` 호출 1곳 → `(accumulate)` 인자 명시(이벤트 누출 차단). 정의1+호출1=2 확인.
- static GREEN: sentinel 19종(python re) + 병합 단위 11종(node) 전부 PASS. 괄호균형 {}/()/[] OK. local interface 제거 0.
- vitest **실행 불가**(sandbox) → operator GREEN.
- ⚠️ 인시던트: Edit 도구가 bash `git show > file` 외부복원과 desync → stale 스냅샷으로 파일 tail 2회 truncate. 복구=`git show HEAD:` 재기록 + 이후 편집 전량 python in-place(디스크 권위). 교훈: bash 로 파일 외부수정 후 같은 파일에 Edit 도구 사용 금지.

**🔴 RED:** wiring 대상 sentinel 확정.
**🟢 GREEN:**
- (A) label-capture 가이드프레임 안에 비차단 글로우 View(absolute, pointer-events 없음, `isLocked` 시 emerald ring+translucent fill, transition).
- (B) label-review 에 "다른 각도 재촬영(누적)" CTA → `handleCaptureLabel(true)` → 결과 `mergeLabelForm` 병합. source flag(`lotScanFilled`/`expiryScanFilled`/`productNameDirty` 등) 병합 정합 갱신. 기존 "재촬영(초기화)" 유지.
- call-site pin sweep: `handleCaptureLabel` 호출부 전수 인자 확인.
**🔵 REFACTOR:** UI 중복 제거, same-canvas 보존.

**✋ Quality Gate:** dead button/no-op 0, front-only success 0, loading/error/empty 상태 유지, §11.340 배지 정확, §11.375 verdict 무변경.
**Rollback:** UI/wiring revert(util 잔존).

### Phase 4: Smoke / Rollback
**Goal:** 안전 배포 + 복구 확인.
- Status: [ ] Pending | [x] In Progress | [ ] Complete (sandbox static GREEN, 기기 smoke=operator 대기)
- sandbox 완료: sentinel 19 + 단위 11 GREEN(static), 괄호균형 OK, rollback=커밋 revert(추가형·비차단·데이터/계약 영향 0).
- operator 대기: ① vitest GREEN ② 모바일 빌드 ③ 기기 smoke ④ push.

**🔴 RED:** rollout 실패 모드 식별, smoke path 정의.
**🟢 GREEN:** sandbox static(vitest sentinel + tsc) GREEN. RN build/device = **실행 불가** → operator 기기 QA 인계. smoke: ① 라벨 검출 시 글로우 노출/비검출 미노출 ② 1샷(catalogNo 無)→"다른 각도 재촬영(누적)"→2샷 B9673 → catalogNo 병합·기존값 보존 ③ verdict/게이팅 무변경.
**🔵 REFACTOR:** 임시 계측 제거, Notes 마감.

**✋ Quality Gate:** static GREEN, rollback 문서화, 기기 QA 항목 isolated.
**Rollback:** 커밋 revert(파일 3종) — feature flag 불필요(추가형·비차단).

## 8. Mobile Addendum (D)

**Must Include:**
- route/stack: `app/scan.tsx`(expo-router) — 변경 없음.
- permission: 카메라 권한 경로 무변경.
- offline/sync: 본 계획 무관(draft 로컬 state).
- iOS/Android: NativeWind className 공통, 분기 불필요.
- safe area: 기존 레이아웃 유지.
- exact action wiring: 누적 재촬영 → merge 캡처, 초기화 재촬영 → resetToScan.

**Validation:**
- [ ] expired-token dead end 없음(스캔 화면 무관).
- [ ] 누적 재촬영 후 빈 화면 없음.
- [ ] 누적 draft 상태 가시(필드 유지).
- [ ] CTA 정확(누적 vs 초기화 구분).

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| §11.340 source flag 병합 회귀 | Med | Med | Phase 2 단위테스트 + Phase 1 회귀 sentinel |
| `handleCaptureLabel` 시그니처 변경 call-site 누락 | Med | Med | pin sweep 강제(§378 교훈) |
| §11.375 over-claim(lock=정합 오인) | Low | Med | UI 문구·주석에 "검출 신호, 진위 아님" 명시 |
| A perf 저하 | Low | Low | 신규 프레임 처리 0(기존 lockState 재사용) |
| RN 미실행을 통과로 위장 | Low | High | Phase 4 "실행 불가" 명시, 기기 QA operator |

## 10. Rollback Strategy

- Phase 1 실패: sentinel/scaffold revert.
- Phase 2 실패: `merge-label-form.ts` 삭제.
- Phase 3 실패: scan.tsx UI/wiring revert(util 잔존).
- Phase 4 실패: 커밋 revert(추가형·비차단이라 데이터/계약 영향 0).
- Special: DB/billing/migration 무관.

## 11. Progress Tracking

- Overall: 80%
- Current phase: Phase 4 (smoke/rollback — operator 기기 QA 인계)
- Current blocker: 없음 (vitest/RN 빌드 sandbox 실행 불가 → operator)
- Next validation: operator vitest GREEN + 기기 smoke(글로우/누적 병합)

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [ ] Phase 4

## 12. Notes & Learnings

**Blockers:**
- (없음)

**Implementation Notes:**
- HANDOFF "웹 glow 이식" → 실측 후 "글로우 1겹 추가 + lockState 바인딩"으로 재정의(픽셀정합 이식 제외).
- 웹 픽셀 정합 메트릭의 모바일 frame-processor 이식은 별 트랙(perf 검증 필요) — defer.
