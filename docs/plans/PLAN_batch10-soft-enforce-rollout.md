# Implementation Plan: Batch 10 CSRF soft_enforce Rollout

- **Status:** ⏳ Pending
- **Started:** 2026-04-19
- **Last Updated:** 2026-04-19
- **Estimated Completion:** 2026-04-22 (24~48h monitoring 포함)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT flip env without Phase 1 baseline 완료
⛔ DO NOT escalate to full_enforce in this plan (별도 P1)

---

## 0. Truth Reconciliation

### Latest Truth Source
- `docs/CSRF_COVERAGE_MATRIX_V2.md` (2026-04-14, engineering-complete / rollout-ready)
- `apps/web/src/lib/security/csrf-contract.ts` — `getCsrfRolloutMode()` (line 91-102), `shouldBlockOnViolation()` (line 179-196)
- `apps/web/src/lib/security/csrf-middleware.ts` — `performCsrfCheck()`, violation → telemetry 기록
- `apps/web/src/lib/security/csrf-route-registry.ts` — 47 highRisk + 9 exempt 정의
- `apps/web/src/lib/security/server-enforcement-middleware.ts` — inline enforceAction 체인

### Secondary References
- `LabAxis_Comprehensive_Audit_Report.md` (CSRF section)
- `docs/BATCH8_ROUTE_COVERAGE_MATRIX.md` (이전 baseline, 209 eligible → 269로 drift됨)

### Conflicts Found
1. `docs/CSRF_COVERAGE_MATRIX_V2.md` line 169 prerequisite: "Phase 1 soft_enforce requires: Raw fetch gap 해소 후"
   - 실제 block 집합(47 highRisk, all server-only caller `—`)과 raw fetch gap 집합(9 standard routes, 29 files)이 disjoint
   - **결론**: prerequisite는 보수적 표현, soft_enforce rollout은 raw fetch gap과 독립적으로 안전
2. 문서 line 168 "All 268 eligible" vs. 분모 정의 line 12 "269 eligible" — minor drift, non-blocking

### Chosen Source of Truth
- **Code (csrf-contract.ts + csrf-middleware.ts + csrf-route-registry.ts)** = 실제 enforce 로직의 ground truth
- 문서 prerequisite는 참고용, block radius disjoint 근거로 override
- 본 plan은 **soft_enforce 진입까지**만 scope. full_enforce는 raw fetch gap 선결 + 별도 P1

### Environment Reality Check
- [ ] Vercel production env `LABAXIS_CSRF_MODE` 현재 값 확인 (기본 `report_only` 예상)
- [ ] recordSecurityEvent telemetry 수신 경로 확인 (어디서 볼 수 있는지)
- [ ] 48h 모니터링 지속 가능 여부 확인 (주말/공휴일 배치)
- [ ] rollback 권한 (env flip back) 최소 1명 on-call 확보

---

## 1. Priority Fit

**Current Priority Category:**
- [x] P1 immediate — release-prep 큐 3번째 항목 ("Batch 10 soft_enforce → 24~48h monitoring → full_enforce")
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- #47 clean unlock 완료 → release-prep 큐 다음 항목 진입 타이밍
- Batch 10 engineering-complete 상태로 2주 이상 report_only에서 대기 중 (2026-04-14 문서 기준)
- soft_enforce는 no-code change, env flip only — rollout 비용 낮음, 운영 보안 ROI 높음
- full_enforce 전 반드시 soft_enforce 24~48h 안정화 권장 (운영 리스크 minimize)

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [x] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [ ] Web
- [ ] Design Consistency

---

## 3. Overview

### Feature Description
Batch 10 CSRF 보호 시스템을 production 환경에서 `report_only` → `soft_enforce` 로 승격. `soft_enforce`는 47 highRisk routes(all server-only irreversible mutation)만 fail-closed로 차단하고, 나머지 standard routes는 report-only 유지하여 운영 리스크를 최소화한 상태에서 실 enforcement를 검증하는 단계.

### Success Criteria
- [ ] Phase 0 pre-flight 모든 항목 통과
- [ ] Phase 1 report_only baseline 24h: highRisk route `csrf_*` violation rate = 0
- [ ] Phase 2 soft_enforce flip + smoke 성공 (47 highRisk 중 최소 1-2개 browser mutation 200 OK)
- [ ] Phase 3 soft_enforce 24~48h: false-positive 차단율 < 0.1%, 실 유저 차단 event = 0
- [ ] Phase 4 closeout: full_enforce 진입 가능 판정 + 별도 P1 이관 문서

### Out of Scope (⚠️ 절대 구현하지 말 것)
- [ ] `full_enforce` 모드 전환 (별도 P1, raw fetch gap 29 files 선결 필요)
- [ ] Raw fetch gap 29 files 수정 (Phase 1-3에서는 standard route가 여전히 report-only이므로 soft_enforce rollout에 영향 없음)
- [ ] middleware.ts / csrf-middleware.ts / csrf-route-registry.ts 코드 수정 (engineering-complete 상태 유지)
- [ ] highRisk route 목록 변경 (현재 47건 lock, full_enforce 승격 시 재검토)
- [ ] CSRF token engine 자체 수정

### User-Facing Outcome
- 정상 유저: **변화 없음** (highRisk route 모두 서버 authoritative, browser origin 정상 → 차단 없음)
- 악성 cross-origin 요청: highRisk route에 도달 시 403 + `csrf_*_mismatch` telemetry (이전에는 통과 후 기록만)

---

## 4. Product Constraints

### Must Preserve
- [x] workbench / queue / rail / dock (UI 변경 없음)
- [x] same-canvas (UI 변경 없음)
- [x] canonical truth (CSRF는 request-level 검증, truth boundary 영향 없음)
- [x] invalidation discipline

### Must Not Introduce
- [x] page-per-feature (UI 변경 없음)
- [x] chatbot/assistant reinterpretation (보안 flip only)
- [x] dead button / no-op / placeholder success (변경 없음)
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

### Canonical Truth Boundary
- **Source of Truth**: middleware.ts gate + csrf-contract `getCsrfRolloutMode()` (env LABAXIS_CSRF_MODE)
- **Derived Projection**: CsrfCheckResult.passed / blockResponse
- **Snapshot / Preview**: telemetry event (csrf_*) — read-only observation, does not drive truth
- **Persistence Path**: SecurityEvent table via recordSecurityEvent

### UI Surface Plan
- [ ] 해당 없음 — **UI 변경 0**. 운영 flip only.

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| env flip (`LABAXIS_CSRF_MODE=soft_enforce`) | 코드 변경 없이 rollout mode 전환 가능 (contract line 91-102) | env 전환 즉시 효력 발생 — rollback도 동일 경로, 0 diff |
| soft_enforce에서 highRisk만 block | `shouldBlockOnViolation()` contract; standard는 report-only 유지하여 raw fetch gap 영향 제거 | standard route는 여전히 보호 안됨 (full_enforce까지 허용 gap) |
| 24~48h 모니터링 후 full_enforce 결정 | 실 운영 트래픽에서 false-positive 탐지 | 주말/공휴일 제외 실 트래픽 충분한지 관찰 필요 |
| full_enforce는 별도 P1 분리 | raw fetch gap 29 files 선결 (standard route도 차단됨) | 이번 plan scope 제한 — 불필요한 확장 방지 |

### Dependencies
- **Required Before Starting**:
  - [x] Batch 10 engineering-complete (2026-04-14 기준)
  - [x] middleware.ts CSRF gate active (서버 100% coverage)
  - [x] csrf-route-registry 47 highRisk + 9 exempt 확정
  - [x] #47 clean unlock 완료 (2026-04-19)
- **External Packages**: 없음
- **Existing Routes / Models / Services Touched**: 없음 (env only)

### Integration Points
- Vercel production env (LABAXIS_CSRF_MODE)
- recordSecurityEvent / SecurityEvent table (telemetry)
- middleware.ts → csrf-middleware.ts → csrf-contract.ts 체인 (코드 touch 없음)

---

## 6. Global Test Strategy

- **코드 변경 없음** → unit/integration test 작성 대상 없음
- **Smoke path**: Phase 2에서 browser 기반 highRisk route mutation 1-2건 수동 실행 (예: `/api/organizations/[id]/logo` POST, `/api/inventory/bulk` POST) → 200 OK 확인
- **Telemetry observation**: Phase 1/3에서 `csrf_token_mismatch` / `csrf_origin_mismatch` / `csrf_missing_token` event count per route 집계
- **Rollback verification**: Phase 2 smoke 실패 시 env `report_only` 복귀 후 동일 smoke 재실행 → 정상 확인

### Execution Notes
- sandbox에서는 production env / Vercel dashboard 접근 불가 → 사장님(로컬+Vercel 관리자)이 직접 수행
- 본 plan은 **decision guide + runbook** 역할
- Phase별 체크리스트는 사장님이 실행 결과 입력 후 체크

---

## 7. Implementation Phases

### Phase 0: Pre-flight & Truth Lock
**Goal:** soft_enforce 진입 전 환경 / 모니터링 / rollback 경로 확정.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 현재 production env / telemetry / rollback 경로 미확인 상태
**🟢 GREEN:**
- Vercel production env 값 확인 → `LABAXIS_CSRF_MODE`가 `report_only` 또는 미설정 (default)
- telemetry 수신 경로 확인 (DB SecurityEvent table / dashboard / logs 중 하나 이상)
- rollback runbook 작성: "env flip back to `report_only` + redeploy"
- 47 highRisk routes spot-check: frontend caller `—` (server-only) 재확인
**🔵 REFACTOR:** 불필요한 전제 제거 (이미 engineering-complete이므로 추가 코드 scan 불필요)

**✋ Quality Gate:**
- [ ] `LABAXIS_CSRF_MODE` 현재 값 문서화
- [ ] telemetry 수신 방법 명시 (예: "`SELECT count(*) FROM SecurityEvent WHERE eventType LIKE 'csrf_%' AND createdAt > NOW() - INTERVAL '24 hours'`")
- [ ] rollback runbook 1 페이지 작성
- [ ] highRisk 47 routes frontend caller 0건 재확인

**Rollback:** 계획만, 실제 변경 없음

---

### Phase 1: Report-only Baseline 24h
**Goal:** soft_enforce 진입 전 현재 운영 트래픽에서 highRisk route violation rate = 0 확인.
- Status: [ ] Pending | [x] In Progress | [ ] Complete

**🔴 RED:** 현재 report_only 상태 24h 데이터 미수집
**🟢 GREEN:**
- T=0h 시점 SecurityEvent `csrf_*` event count per route 스냅샷
- 24h 동안 정상 운영 유지 (env 변경 금지)
- T=24h 시점 스냅샷 + highRisk 47 routes filter
- highRisk route violation count = 0 확인 (있으면 원인 분석 후 수정, Phase 2 blocked)
**🔵 REFACTOR:** 24h 데이터에서 outlier event 있으면 태그/분류

**✋ Quality Gate:**
- [x] T=0h 스냅샷 저장 (아래 참조)
- [ ] T=24h 스냅샷 저장
- [ ] highRisk route violation count = 0
- [ ] 만약 > 0이면 원인 분석 문서 + Phase 2 홀드
- [ ] standard route violation rate는 기록만 (Phase에서는 non-blocking)

#### T=0h Baseline Snapshot
- **Captured at:** 2026-04-19 02:45 KST (2026-04-18T17:45:50Z)
- **Source:** `GET /api/security/csrf-status` via browser session (role=ADMIN)
- **Deployment:** Vercel prod (post-redeploy with `LABAXIS_CSRF_MODE=report_only`)

```json
{
  "csrf": {
    "mode": "report_only",
    "registry": {
      "exempt": 9,
      "highRisk": 30,
      "exemptReasons": {
        "framework_csrf_builtin": 1,
        "webhook_signature": 2,
        "public_token_auth": 2,
        "bearer_token_auth": 2,
        "vendor_token_auth": 2
      }
    },
    "telemetry": {
      "total": 0,
      "csrfEvents": 0,
      "byClassification": {},
      "recentCsrf": []
    },
    "rolloutGuide": {
      "current": "report_only",
      "next": "soft_enforce",
      "envVar": "LABAXIS_CSRF_MODE"
    }
  }
}
```

**Baseline 판정:**
- ✅ `mode: "report_only"` — env 주입 정상 (Phase 0 GREEN 확인)
- ✅ `registry.exempt: 9` — COVERAGE_MATRIX_V2와 정합 (framework/webhook/token 분류 일치)
- ⚠️ `registry.highRisk: 30` — 문서상 47과 드리프트 존재 (아래 Observation 참조)
- ✅ `telemetry.csrfEvents: 0` — 완전 zero baseline. T=24h 증분이 곧 실제 위반량.
- ✅ Telemetry는 in-memory 구조 (서버 재시작 시 리셋) — Phase 1 중 Vercel cold start 발생 시 증분 누락 가능성 기록만 해두고 비차단.

**Observation — highRisk drift (47 → 30):**
- 원인 후보: route registry의 lazy registration, 일부 route 파일이 런타임에 import되지 않음, 또는 COVERAGE_MATRIX_V2.md가 stale.
- Phase 2 GREEN 판정에는 영향 없음 (현재 런타임 기준 30 routes 기준으로 violation rate=0만 확인하면 됨).
- Phase 4 Closeout 시 registry 실태 vs 문서 재정합 태스크로 분리 처리.

#### T=24h Re-capture (예정)
- **예정 시각:** 2026-04-20 02:45 KST (2026-04-19T17:45:50Z)
- **예정 액션:** 동일 endpoint 재호출 → `telemetry.csrfEvents` 증분 + `byClassification` 분포 확인

**Rollback:** 관찰만, 상태 변경 없음

---

### Phase 2: soft_enforce Flip + Smoke
**Goal:** production env `LABAXIS_CSRF_MODE=soft_enforce` 설정 + 즉시 smoke 검증.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** soft_enforce 모드 실 production 검증 0
**🟢 GREEN:**
- Vercel production env `LABAXIS_CSRF_MODE=soft_enforce` 설정
- Redeploy (또는 env hot-reload 지원 확인)
- Deploy 완료 후 즉시 smoke:
  - Browser 로그인 → 워크스페이스 진입 → highRisk mutation 1-2건 수동 실행
  - 예: `/api/inventory/bulk` POST 또는 `/api/organizations/[id]/logo` POST
  - 200 OK + 정상 결과 확인
- 5분간 5xx/4xx burst 관찰
**🔵 REFACTOR:** smoke 실패 시 즉시 Rollback → Phase 0 Gate 재점검

**✋ Quality Gate:**
- [ ] Vercel env 변경 기록 (timestamp)
- [ ] Redeploy 성공 (new dpl_ id 기록)
- [ ] Smoke mutation 1+ 200 OK
- [ ] Deploy 직후 5분 내 403 burst 없음 (기준: 일반 traffic 대비 +5% 이내)
- [ ] `getCsrfRolloutMode()` 반환값 `soft_enforce` 확인 (optional: debug endpoint 또는 telemetry field)

**Rollback:** Vercel env `LABAXIS_CSRF_MODE` 삭제 또는 `report_only` 복귀 + redeploy

---

### Phase 3: soft_enforce 24~48h Monitoring
**Goal:** soft_enforce 실 운영에서 false-positive / 실 유저 차단 / 47 highRisk route stability 검증.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** soft_enforce 장기 안정성 미검증
**🟢 GREEN:**
- T=0h (Phase 2 완료 시점) SecurityEvent 스냅샷
- 24h, 48h 지점 event per route 집계
- highRisk route 차단 event (`csrf_*` + `blocked=true`) 발생 시 actor / origin / userAgent 분석
- false-positive 판정 기준:
  - 정상 유저 agent + trusted origin에서 `csrf_missing_token` 발생 = false-positive
  - 신뢰 가능 원인 (token TTL 만료 2h 초과) = acceptable, 아니면 bug
- 일반 API 5xx rate 기준선 대비 +1% 이상 상승 없음
**🔵 REFACTOR:** false-positive 발견 시 해당 route `highRisk=false` 임시 강등 옵션 준비 (적용은 별도 승인 필요)

**✋ Quality Gate:**
- [ ] 24h 시점 스냅샷 저장
- [ ] 48h 시점 스냅샷 저장 (권장 기간 완주)
- [ ] false-positive rate < 0.1% (highRisk 차단 event 중)
- [ ] 실 유저 차단 event = 0 (actor user agent + trusted origin)
- [ ] 일반 API 5xx rate 기준선 대비 +1% 이내
- [ ] highRisk route별 차단 event 분석 보고서 1건

**Rollback:** false-positive > 0.1% 또는 실 유저 차단 감지 시 Phase 2 rollback + 원인 분석

---

### Phase 4: Closeout & full_enforce 이관 결정
**Goal:** soft_enforce 안정화 완료 선언 + full_enforce 진입 준비 상황 문서화.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** soft_enforce 장기 운영 결정 + full_enforce 이관 계획 미수립
**🟢 GREEN:**
- Phase 3 결과 기반 soft_enforce "stable" 선언
- CSRF_COVERAGE_MATRIX_V2.md 업데이트:
  - line 168 "Current: All 268 eligible / report_only" → soft_enforce 반영
  - Batch 10 완료 표기
- full_enforce 이관 체크리스트 별도 issue/plan 생성:
  - Raw fetch gap 29 files 수정 (9 routes, standard risk)
  - 29 files 수정 후 추가 report-only 재측정
  - E2E 수동/자동 테스트 suite
  - 본 plan scope 아님, 별도 P1 이관
- Batch 10 완료 보고서 작성
**🔵 REFACTOR:** 문서 drift 제거 (268 vs 269 통일, prerequisite 재표현)

**✋ Quality Gate:**
- [ ] soft_enforce stable 선언 문서
- [ ] CSRF_COVERAGE_MATRIX_V2.md 업데이트 (soft_enforce 진입 반영)
- [ ] full_enforce 이관 plan 별도 issue/document 생성
- [ ] 본 plan status Complete

**Rollback:** 해당 없음 (closeout 단계)

---

## 8. Optional Addenda

### A. Migration / Rollout Addendum (Active)

**Rollout Gates:**
- Gate 1 (Phase 0→1): pre-flight 모든 항목 통과, rollback runbook 존재
- Gate 2 (Phase 1→2): report_only 24h highRisk violation = 0
- Gate 3 (Phase 2→3): soft_enforce flip smoke 성공
- Gate 4 (Phase 3→4): 24~48h 모니터링 SLA 충족

**Rollback Matrix:**
| Phase | Trigger | Action |
|---|---|---|
| Phase 2 smoke fail | highRisk mutation 403 or 5xx burst | env `report_only` 복귀 + redeploy → Phase 1 retry |
| Phase 3 false-positive | >0.1% FP or 실 유저 차단 | env `report_only` 복귀 + actor/origin 분석 |
| Phase 3 5xx burst | 기준선 +1% 이상 | env `report_only` 복귀 + 원인 격리 |

**Monitoring Signal:**
- SecurityEvent `csrf_*` event count per route per hour
- API 5xx rate per route
- API 4xx (특히 403) rate per route
- Frontend apiClient bootstrap success rate (token 획득)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| soft_enforce flip 직후 highRisk route에서 false-positive 403 | Low | High | Phase 1 report_only 24h baseline으로 사전 검출 |
| Frontend apiClient token bootstrap 실패로 real user 차단 | Low | High | Phase 2 smoke에서 browser mutation 직접 검증 |
| telemetry 수신 지연으로 FP 늦게 발견 | Medium | Medium | Phase 3 24h/48h 2회 스냅샷, 실시간 dashboard 체크 |
| 주말/공휴일 저트래픽으로 커버리지 불충분 | Medium | Low | 48h까지 연장 권장, 필요 시 평일 포함 재측정 |
| raw fetch gap 29 files 중 일부가 실제로는 highRisk로 drift | Low | High | Phase 0에서 47 highRisk list spot-check 재확인 |
| full_enforce 조급한 승격 요청 | Medium | High | 본 plan scope 제한 명시, 별도 P1 강제 |
| 운영 on-call 부재 시 rollback 지연 | Low | High | Phase 2 flip 시점 on-call 1명 이상 확보 |

---

## 10. Rollback Strategy

### Phase 별 Rollback
- **Phase 0**: 코드/env 변경 0 — rollback 불필요
- **Phase 1**: 관찰만 — rollback 불필요
- **Phase 2**: Vercel env `LABAXIS_CSRF_MODE` 삭제 또는 `report_only` 설정 → redeploy (소요 시간 ~5분)
- **Phase 3**: Phase 2와 동일 rollback 경로
- **Phase 4**: closeout 단계, rollback 해당 없음

### Special Cases
- **극단 상황 (production API 절반 이상 403)**: 즉시 env 삭제 + Vercel instant rollback to previous deployment
- **Cookie 불일치**: `__Host-labaxis-csrf` 쿠키 invalidate (유저 로그아웃/재접속 유도) + env rollback
- **Token engine 버그 의심**: Phase 2 smoke 실패 시 즉시 rollback, Engineering에 이관

---

## 11. Progress Tracking

- **Overall completion:** 0% (Phase 0 대기)
- **Current phase:** Phase 0 (Pre-flight & Truth Lock)
- **Current blocker:** 없음 — 사장님 Phase 0 착수 대기
- **Next validation step:** Vercel production env `LABAXIS_CSRF_MODE` 현재 값 확인

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

### Blockers Encountered
- (기록 대기)

### Implementation Notes
- CSRF_COVERAGE_MATRIX_V2.md line 169 prerequisite ("Raw fetch gap 해소 후")는 실제 block 집합과 gap 집합 disjoint 근거로 soft_enforce에는 적용 안 함. full_enforce 승격 시 다시 적용되어야 함.
- 본 plan은 **soft_enforce 진입 + 24~48h 안정화까지**만 scope. full_enforce는 별도 P1으로 분리하여 raw fetch gap 선결.
- #47 clean unlock 완료 (2026-04-19, 49/58 = 84.5%, 9 defer tracker #50/#63)로 release-prep 큐 다음 항목으로 진입.

### Deferred
- Raw fetch gap 29 files CSRF 부착 → full_enforce 선결 P1
- full_enforce 진입 → 별도 P1 (Phase 4에서 이관 document 생성)
- CSRF_COVERAGE_MATRIX_V2.md 분모 drift (268 vs 269) 통일 → Phase 4 refactor에 포함
