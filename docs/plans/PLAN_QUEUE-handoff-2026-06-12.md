# PLAN_QUEUE handoff — 2026-06-12 세션 마감

호영님 closing 결정(C 분기): PLAN sync deferred + **named pin** 으로 등재 (drift 차단).

eas.json 교훈("추상적 지연은 32 batch 썩는다") 정합 — vague "다음 세션 1순위" 금지,
구체 핀으로 stale 위험 차단. 두 PLAN 의 결정은 본 대화에 전부 기록돼 있어 sandbox 카드
분실해도 재구성 가능 (C 의 안전망).

## 1순위 pin — PLAN sync 2건

### ① `PLAN_scan-gs1-connect.md` (§11.382)

**소스**: 이번 세션 §11.382 #scan-gs1-connect (`365eead3`, push 완료).

**P1~P4 결정 (대화 기록 그대로)**:
- **Truth**: 라벨 직접등록 GS1 datamatrix 미연결(primary) + Tier2 폴백 env-gated silent.
  Ambion 등 best-case GS1 라벨 empty 추출.
- **P1+P2 머신** (`lib/ocr/merge-gs1-ocr.ts`): source-based — GS1 결정적 우선 + source 태그
  + conflict 검출 + isFieldVerified(gs1+불일치 0). 단위 10 + sentinel 12.
- **P3 wiring**: scan-label `gs1Raw` 수용 → parseGs1(서버 single impl) → mergeGs1WithOcr.
  모달 zxing datamatrix/QR 클라 디코드(dynamic import).
- **P4**:
  - (a) verified gate 실연결 — `verified:{lot:false,expiry:false}` 하드코딩 2곳 제거
    (datamatrix Lot/EXP 터치 확인 면제).
  - (b) "GS1 검증" emerald 배지 2곳 (Lot/유효기간).
  - `run-ocr-pipeline.ts` `fallbackReason`(high_confidence / tier2_unconfigured /
    tier2_error / null) — Tier2 silent degradation 제거.
- **canonical**: GS1=verified(checksum), Gemini=확인필요. 디코드 클라, parseGs1 서버 single impl.
- **production effect**: GS1 라벨 Lot/EXP 결정적 추출(blank 봉합) + 터치 확인 면제 +
  Gemini fallback 2중 보존(회귀 0).
- **Out of Scope**: 모바일 GS1 mirror, GTIN→catalog 매핑, #5 단위(web 정상).
- **Rollback**: 모달/scan-label revert → Gemini 단독 복귀. 스키마 0 / 신규 패키지 0.
- **검증**: 22/22 + 무회귀 61/61 + tsc clean + build 291/291 PASS.

### ② `PLAN_concurrency-key-scheme.md` (§11.369-3)

**소스**: 이번 세션 §11.369-3 #concurrency-key-isolation + P4 #message-honesty
(`e0137747` + `000ef10b`, push 완료).

**P0~P4 결정 (대화 기록 그대로)**:
- **Truth**: enforceAction targetEntityId:'unknown' 고정 → 60+ route 가 전역 단일 lock
  공유. 한 route leak 이 무관 route 잠금(cross-route stale-lock). §11.369-2(ai-insight)는
  단일 route 증상, 본 fix 는 infra 본체.
- **P1+P2 머신** (`lib/security/concurrency-key.ts`): `deriveConcurrencyKey` —
  `${action}:${routePath}:${resource}`. resource = targetEntityId(있으면) ‖ userId
  (fallback, double-submit 보호). per-call UUID/timestamp 금지(결정적 키여야 중복클릭
  차단 성립). 단위 6 + sentinel 8.
- **P3 wiring (infra 1곳 → 60+ route)**:
  - `mutation-replay-guard.ts` begin/failMutation 시그니처 (action,entityId) → 단일
    concurrencyKey:string. completeMutation 불변(fingerprint 주목적).
  - `server-enforcement-middleware.ts` inline 경로(enforceAction): deriveConcurrencyKey
    단일 선언 → begin/complete/fail 동일 변수 참조(begin≠complete 영구 leak 방지) +
    `readOnly` skip 분기 + `InlineEnforcementConfig.readOnly`.
  - wrapper 경로: `wrapperKey=\`${action}:${entityId}\`` 명시 (completeMutation 내부
    키와 일치, 동작 불변 — routePath 부재라 후속).
  - 호출처 전수 정합: middleware 6곳 + `security-hardening-batch0.test.ts` 2곳.
- **P4 메시지 정직화 (전 surface)**:
  - "같은 항목에 대한 다른 작업이 진행 중입니다" → "처리 중인 동일 요청이 있습니다.
    잠시 후 다시 시도하세요." (이중거짓 제거 — P3 키 격리 후 "다른 작업" 거짓).
  - 4 surface: `server-enforcement-middleware.ts:300/583` + `frontend-leak-guard.ts:151`
    + `mutation-replay-guard.ts:139` + `CheckoutDialog.tsx:740`(주석 자체 검출).
  - sentinel P4 확장(3 surface 부재 락).
- **canonical**: lock TTL/release infra(ACTIVE_MUTATIONS/hasActiveLock) 불변 — 키 derive
  + 메시지 상수만.
- **production effect**: cross-route stale-lock 소멸 / per-user/resource 격리 / 409
  메시지 정직(double-submit 시에만).
- **Out of Scope (후속 별 트랙, 영향 경미)**:
  - wrapper deriveConcurrencyKey (routePath 소스, leak 없음).
  - 잔여 inline route complete/fail finally (P3 로 자기 route+user 국소화).
  - 동일 구 문구 정합 잔여(이미 본 P4 로 4 surface 종결, frontend-leak-guard:151 +
    mutation-replay-guard:139 포함).
- **Rollback**: P3 patch revert(시그니처 변경 호출처 동반) / P4 메시지 4곳 revert(상수만).
- **검증**: concurrency-key 17/17 + 보안 suite 무회귀 124/124 + tsc 전수 정합 +
  build 291/291 PASS.

## 처리 지시 (다음 세션 첫 batch)

1. 본 파일의 §1/§2 결정 본문 → 각각 `PLAN_scan-gs1-connect.md` / `PLAN_concurrency-key-scheme.md`
   로 docs/plans 신규 작성 (본 파일이 sandbox 카드 분실 시 재구성 소스).
2. 신규 2 PLAN commit + push.
3. 본 PLAN_QUEUE-handoff 파일 archive 처리 (handoff 완료 표식).

## 후속 별 트랙 (별 큐, 영향 경미)

- §11.369-3 잔여:
  - wrapper deriveConcurrencyKey (routePath 소스 추가, cross-route 충돌만 — leak 0).
  - 잔여 inline route complete/fail finally (자기 route+user 국소화됨, 자기 재호출 TTL).
- §11.382 잔여:
  - 모바일 GS1 mirror.
  - GTIN→catalog 매핑 roadmap.
- 횡단 stale-lock 트랙 1순위 (직전 세션 결정 유지):
  - `complete=0 fail=0 unknown=1` 60+ route 중 mutation 보유분 전수 봉합
    (§11.369-2 ai-insight = 패턴 실증, §11.369-3 = infra 본체).
- catalog backfill · banner/RFQ · demand-signal (직전 세션 큐 그대로).
