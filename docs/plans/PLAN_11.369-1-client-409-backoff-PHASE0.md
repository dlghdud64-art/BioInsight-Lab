# §11.369-1 클라 409 backoff — Phase 0 정독 결과 (구현은 새 세션)

- **Status:** Phase 0 완료(정독) · 구현 새 세션
- **작성:** 2026-06-07
- **트랙 성격:** 증상완화(클라 UX). 서버 lock 근본은 `BACKLOG_11.369_server-lock-stale.md` 분리.

---

## 결론 요약 (먼저)

**6/5 큐의 fix locus("SmartReceivingScannerModal.handleSubmit 409 분기")는 부정확하다.**
현 코드 기준 **스마트 입고 경로는 409(concurrent_mutation)를 구조적으로 던지지 않는다.** 409 "같은 항목에 대한 다른 작업이 진행 중"은 `enforceAction` 미들웨어를 쓰는 *다른* mutation 라우트에서만 발생한다. 따라서 §11.369-1은 fix locus를 재정의해야 한다.

---

## 항목 1 — 라이브 "스마트 입고" 경로 (단정)

- 진입: `dashboard/inventory/inventory-main.tsx` L1078 → **`SmartReceivingScannerModal`** (parse-image/upload 흐름). `LabelScannerModal`(카메라)은 search/scan/inventory-content/global-modal 경로.
- `SmartReceivingScannerModal.handleSubmit`(L304~)의 두 종착:
  - (a) 발주매핑: `PATCH /api/orders/[id]` — 해당 route는 `order_update` **audit action만**, `enforceAction` **미사용** → 409 없음.
  - (b) OCR 입고: `POST /api/inventory/smart-receiving` — `enforceAction` **미사용**(route L54–56 "security middleware import 제거" 명시) → 409 없음. 반환은 401/400/403/404/500뿐.
- **∴ 스마트 입고 양쪽 경로 모두 concurrent-lock 409를 던지지 않는다.**

## 항목 2 — 409를 던지는 실제 mutation (확정)

- 출처 = `lib/security/server-enforcement-middleware.ts` `enforceAction(...).deny()` (L570–571): lock 미획득(`beginMutation` false = `hasActiveLock` true) → **409**.
- lock key = `${action}:${targetEntityId}` (`mutation-replay-guard.ts` L271/299), TTL **5분**, `hasActiveLock`가 stale 자동 prune(L117–125).
- cold-kill 경로: `beginMutation` 후 람다 강제종료 → `completeMutation`/`failMutation`(L309/332) 미실행 → 해당 인스턴스에 ≤5분 lock 잔존.
- `enforceAction` 사용 라우트(대표): `inventory_create`(productId), `inventory_import`('bulk'), `order_create`(quoteId), `scan-label`(sensitive_data_import: **매 요청 randomUUID** → lock 충돌 사실상 0), 다수 ai-ops/ai-actions. **이미 `CheckoutDialog.tsx` L740이 이 409를 클라에서 핸들링 중(모범 사례).**
- ✅ 미확인 해소(2026-06-08 재검증): `/api/inventory/[id]/restock` **enforceAction 사용 확정**(L77 `action: 'inventory_restock'`) → 409 source 맞음. 단 스마트입고는 이 route 미경유(smart-receiving 직접) → 항목 1 불변. restock(수동 재고보충 버튼)은 Phase 1 공통 핸들러 **consumer 후보**에 추가.
- ✅ 추가 consumer(재검증): `inventory_use`(출고/사용, 2건)도 enforceAction 409 source. (참고: §notif INVENTORY_LOW dispatch 는 enforcement.complete 성공 후 best-effort라 409 경로 무간섭.)

## 항목 3 — 멱등키 (확정)

- guard 인프라에 `idempotencyKey`는 존재하나, 이는 `checkMutationReplayGuard`(중복실행 fingerprint)용. **`enforceAction`의 동시성 lock(`beginMutation`)은 `action:targetEntityId`만으로 판정 — 멱등키 무관.**
- 클라(`csrfFetch`/handleSubmit)는 멱등키 헤더를 보내지 않는다.
- ∴ **클라는 409가 "stale lock(cold-kill 잔존)"인지 "진짜 동시 진행"인지 식별 불가.** → 클라 트랙은 **backoff 자동재시도 + 정직 안내**로 한정(호영님 경계와 정확히 일치). 멱등 소유자 식별은 서버 영역(백로그).

---

## 라이브 검증 (2026-06-07, Vercel prod 로그)

- prod runtime logs 최근 **7일**: `statusCode=409` **0건**, `"다른 작업이 진행 중"` **0건**, `concurrent_mutation` **0건**.
- ∴ §11.369-1 증상은 **현재 라이브에서 미발생**. 6/5 큐 증상은 stale(과거 enforceAction 사용 시절/일시적)일 가능성 높음.
- **우선순위 강등: P-라이브 → 예방적/낮음.** 클라 409 공통 핸들러는 "있으면 좋은" 견고화이지 현재 활성 버그 아님. (로그 보존 7일 한계는 감안 — 장기 빈도는 BACKLOG 측정 항목 참조.)

## 재정의된 Fix Locus (Phase 1 예고 — 구현 X)

§11.369-1의 진짜 목표 = **"무한 409 반복 + '다른 작업 진행 중' 메시지"를 정직 안내(최대 ~5분 후 자동 해제) + backoff 자동재시도 + 수동 재시도 버튼으로 전환.**

- **대상은 스마트 입고가 아니라 `enforceAction` 409를 받는 클라들.** `CheckoutDialog`(L740) 패턴을 공통 핸들러로 추출해 재사용 권장.
- 우선 라이브에서 "스마트 입고 재시도 409"가 실제 재현되는지 확인 필요 — 현 코드론 미발생이므로 6/5 증상이 **stale(과거 enforceAction 사용 시절 흔적)**일 가능성. 재현 안 되면 트랙을 "enforceAction 409 공통 핸들러"로만 좁힌다.
- 서버 lock(TTL/이중해제)은 canonical truth → 불변. 클라 UX만.

## Phase 1 범위 (구현, 새 세션)
- 409 수신 공통 핸들러: 정직 안내 문구 + 지수 backoff 자동재시도(상한) + 수동 재시도 버튼. 무한 동일 메시지 반복 금지.
- 적용 지점: enforceAction 409 소비 클라(우선 CheckoutDialog 패턴 일반화). 스마트입고는 409 미발생이므로 제외(또는 라이브 재현 확인 후 판단).
- 회귀 0: 서버 lock/guard 무변경, 기존 성공/에러 흐름 보존.

## Rollback
- 클라 핸들러 한정 → 해당 컴포넌트 diff revert. 서버 영향 0.
