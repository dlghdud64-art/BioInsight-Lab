# Implementation Plan: §pricing-enforce-p2 — 라벨스캔 월 카운터 enforce + trackingMode 플랜 게이팅

- **Status:** ⏳ Pending
- **Started:** 2026-06-27
- **Last Updated:** 2026-06-27
- **Work Type:** Billing / Entitlement + Migration/Rollout

**CRITICAL INSTRUCTIONS** (phase 완료마다):
1. ✅ 체크박스 갱신  2. 🧪 quality gate 명령 실행  3. ⚠️ gate 전 항목 통과 확인
4. 📅 Last Updated 갱신  5. 📝 Notes 기록  6. ➡️ 그 다음에만 다음 phase

⛔ quality gate 실패/충돌 미해소 상태로 진행 금지 · dead button/no-op/placeholder success 금지
⛔ prod DB 변경은 dry-run → 평이한 한국어 보고 → "진행" 후에만 apply (DEV_RUNBOOK §9.9). sandbox migrate/db push 금지.

---

## 0. Truth Reconciliation
- **Latest truth**: P1 land(bb2b7554). `lib/plans.ts`에 `maxLabelScansPerMonth`(Free 10/Basic·Pro null) + `allowedTrackingModes`(Free·Basic=[QUANTITY] / Pro=[QUANTITY,LOT,GMP_STRICT]) field 존재하나 **enforce 0(휴면)**.
- **enforce 패턴**: `lib/billing/enforce-plan-limit.ts` — kind=quotes/inventory. grandfather=`PRICING_ENFORCE_CUTOFF` env(미설정=전원 통과). 카운트=이번달 row count, 초과 시 `PlanLimitError` throw → 라우트 429.
- **trackingMode 설정 지점**: `api/inventory/route.ts:290`(생성) + `api/inventory/[id]/route.ts:168`(수정) — LOT/GMP_STRICT를 **plan 체크 없이** 저장. `lib/inventory/tracking-mode.ts`는 차감 필수필드 검증만(plan 허용 아님).
- **라벨스캔 카운트 소스 부재(충돌)**: `api/inventory/scan-label/route.ts`는 파싱만, 스캔을 DB 기록 안 함. `OcrJob`은 STORAGE_PROVIDER 설정 시에만 생성(regex/미설정=null) → 신뢰 카운트 소스 아님.
- **Chosen SoT**: entitlement=`lib/plans.ts`. trackingMode canonical=`Inventory.trackingMode`. 라벨스캔 카운트 SoT=**신규 경량 `LabelScanEvent` 모델**(호영님 2026-06-27 결정).
- **Environment**: sandbox vitest 실행 불가(rollup 네이티브 누락). prod migration·push는 클로드코드 operator-shell 단독. 정적 replay + operator-shell 권위 게이트 병행.

## 1. Priority Fit
- [x] Post-release / P2 (CEO 승인 트랙). P1 충돌 0. P1이 연 field만 land → enforce gap을 닫아 honesty 정합.

## 2. Work Type
- [x] Billing / Entitlement   - [x] Migration / Rollout

## 3. Overview
**기능**: P1이 추가한 휴면 field 2종을 실제 강제로 전환. ① Free 라벨스캔 월 10회 enforce(초과 429+품위 안내) ② LOT/GMP_STRICT 추적모드는 Pro만 설정 가능(미허용 plan 품위 안내).

**Success Criteria:**
- [ ] Free 사용자가 월 10회 초과 스캔 시 429 + 한도/사용량/업그레이드 안내(정직). Basic·Pro 무제한 통과.
- [ ] Free·Basic이 LOT/GMP_STRICT 설정 시도 시 차단 + 품위 안내(403). Pro는 허용.
- [ ] grandfather(`PRICING_ENFORCE_CUTOFF` 미설정)=전원 통과(무해 롤아웃).
- [ ] 표기=enforce 일치(fake claim 0). 신규 회귀 0.

**Out of Scope (⚠️ 구현 금지):**
- [ ] /pricing UI에 "월 10회" 노출(P3) · 라벨스캔 사용량 대시보드 위젯 · OcrJob 통합
- [ ] §11.30x-cleanup(사전 stale 3건)

**User-Facing Outcome**: Free는 월 10 스캔 후 업그레이드 안내, LOT/GMP는 Pro 전용으로 정직하게 게이팅.

## 4. Product Constraints
**Must Preserve:** workbench/queue/rail/dock · same-canvas · canonical truth(plans.ts·Inventory.trackingMode) · scan-label의 enforceAction(RBAC)·OCR lock/complete 흐름
**Must Not Introduce:** page-per-feature · dead button/no-op/placeholder success · fake counter(표기≠enforce) · preview가 truth 대체

**Canonical Truth Boundary:**
- Source of Truth: `plans.ts`(한도) · `Inventory.trackingMode`(정책) · `LabelScanEvent`(스캔 카운트)
- Derived: 이번달 스캔 count(LabelScanEvent where createdAt>=월초)
- Persistence: scan-label 성공 시 `LabelScanEvent` 1 row insert
- Snapshot/Preview: 없음

**UI Surface Plan:** [x] 기존 라우트(서버 게이트) — 신규 페이지 0. 클라 선제 안내는 기존 모달 상태로 흡수.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| 신규 경량 `LabelScanEvent`(id·userId·organizationId?·createdAt) | enforce 카운트 SoT 정직 확보. OcrJob 불신뢰 회피 | prod migration 1회 필요(§9.9 게이트) |
| enforce-plan-limit "labelScan" kind 추가 | 기존 grandfather/무제한/throw 패턴 재사용(최소 diff) | scan-label 라우트에 enforce 삽입 |
| trackingMode 게이팅은 2 라우트 server gate | canonical 정책 보호·migration 0 | 클라도 선제 안내 권장(품위) |

**Touched (예상):** `prisma/schema.prisma`(신규 모델) · `lib/billing/enforce-plan-limit.ts` · `app/api/inventory/scan-label/route.ts` · `app/api/inventory/route.ts` · `app/api/inventory/[id]/route.ts` · 신규 sentinel.
**Required before:** prod migration dry-run 승인(P3).

## 6. Global Test Strategy
- enforce 로직·trackingMode 게이팅 → 단위/sentinel(readFileSync+regex) 우선(RED→GREEN).
- 라우트 계약 → 통합 의도 sentinel(import·호출·429/403·instanceof).
- migration → dry-run + rollback 검증.
- sandbox vitest 불가 시 정적 replay + operator-shell 권위 게이트로 baseline 보고.

## 7. Implementation Phases

### Phase 0 — Context & Truth Lock — [x] (2026-06-27)
**🔴** 카운트 소스 부재·trackingMode 무게이팅 확정, prod-migration 게이트 확인
**🟢** `LabelScanEvent` 필드 확정(최소: id, userId, createdAt; organizationId optional), grandfather env 재사용 확인
**🔵** 스코프 축소(OcrJob 비건드림)
**✋ Gate:** 충돌 0 · 카운트 SoT 확정 · migration 범위 명시  **Rollback:** planning-only

### Phase 1 — 계약 & 실패 테스트 — [x] (2026-06-27, sentinel: tracking-mode-plan-gating-p2.test.ts)
**🔴** sentinel(RED): enforce "labelScan" kind 존재 · scan-label이 enforcePlanLimit("labelScan") 호출+429 · inventory POST/PATCH가 allowedTrackingModes 게이트+403 · LabelScanEvent 모델 존재
**🟢** 최소 계약 스캐폴딩
**🔵** 명명 정리
**✋ Gate:** 실패테스트 real · 기존 테스트 GREEN 유지 · lint/typecheck 문서화  **Rollback:** sentinel revert

### Phase 2 — trackingMode 게이팅 (migration 0, 우선 land) — [x] (2026-06-27)
**🔴** 게이팅 단위테스트(Free/Basic LOT→차단, Pro→허용)
**🟢** `route.ts`·`[id]/route.ts`에 plan→getPlanLimits→allowedTrackingModes 게이트. 미허용 시 403+품위 안내(또는 QUANTITY 강제 정책 택1, Phase 0 확정). canonical Inventory.trackingMode 보존
**🔵** 중복 제거·same-canvas
**✋ Gate:** dead-end 0·품위 안내·기존 trackingMode 흐름(usage 게이팅) 회귀 0  **Rollback:** 2 라우트 게이트 revert

### Phase 3 — 라벨스캔 카운터 + migration — [ ]
**🔴** rollout 실패모드·smoke 정의 · enforce 카운트 단위테스트
**🟢** ① `LabelScanEvent` 모델 추가 → **migration dry-run → 한글 보고 → "진행" → apply(operator-shell)** ② enforce "labelScan" kind(count=이번달 LabelScanEvent, 한도=maxLabelScansPerMonth, null=통과) ③ scan-label 성공 직전 LabelScanEvent insert + enforce 선제 호출(enforceAction·OCR lock/complete 보존)
**🔵** 임시 계측 제거
**✋ Gate:** 표기=enforce 일치 · grandfather 무해 · lock/complete 회귀 0 · 카운트 정직  **Rollback:** schema revert(빈 테이블 drop 안전) + enforce 분기 revert

### Phase 4 — Rollout / Smoke / Rollback — [ ]
**🔴** rollout 게이트(`PRICING_ENFORCE_CUTOFF`)·smoke path
**🟢** smoke: Free 11회차 429 · Basic 통과 · Free LOT 403 · Pro LOT 허용 · cutoff 미설정 전원 통과
**🔵** notes 정리
**✋ Gate:** rollout 안전 · rollback 문서 · 잔여 blocker 격리  **Rollback:** env(cutoff)·schema·route 단계별

## 8. Addenda
**B. Billing/Entitlement:** 한도 초과=429(견적/재고 패턴 동일), 게이팅=403. grandfather=cutoff env. logged-in 추가 로그인 프롬프트 0.
**D(부분) Mobile:** 모바일 스캔도 같은 서버 라우트 통과 → 게이트 자동 적용. 모바일 클라 선제 안내는 별도(P3/모바일 배치) defer.

## 9. Risks
| Risk | P | Impact | Mitigation |
|---|---|---|---|
| prod migration(§9.9) | Med | Med | dry-run→한글 보고→"진행"·신규 빈 테이블이라 파괴성 0·sandbox 금지 |
| scan-label enforce 삽입이 OCR lock/complete 흐름 깨짐 | Med | Med | enforce를 enforceAction 직후·파싱 전 배치, 기존 complete()/fail() 보존, 회귀 sentinel |
| 카운트 timing(파싱 실패 시 카운트?) | Med | Low | 성공 응답 직전에만 insert(실패=미카운트, 정직) |
| trackingMode 차단 UX dead-end | Low | Med | 403+업그레이드 품위 안내, 클라 선제 비활성 사유 노출 |

## 10. Rollback Strategy
- P1 실패: sentinel revert
- P2 실패: trackingMode 게이트 2 라우트 revert (migration 무관)
- P3 실패: enforce 분기 revert + schema revert(빈 테이블 drop)
- P4 실패: `PRICING_ENFORCE_CUTOFF` 미설정으로 전원 통과(즉시 무력화)

## 11. Progress Tracking
- Overall: 60%  · Current phase: P2a land 대기(push)  · Blocker: 없음  · Next: P3(LabelScanEvent migration — dry-run 게이트)
- [x] P0  [x] P1  [x] P2  [ ] P3  [ ] P4

## 12. Notes & Learnings
- 2026-06-27: 계획 생성. P2b 카운트 소스=신규 경량 LabelScanEvent(호영님 결정). P2a(trackingMode 게이팅, migration 0)를 P2b(카운터, migration)보다 먼저 land.
