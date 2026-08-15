# §audit-integrity-fix — 감사 무결성 수정 설계안

- **Status:** 🟡 설계안 (2026-08-15). 구현 0. 호영님 검토 대기
- **선행 확진:** §audit-integrity-200-mask (실패 주입 2/2)
- **방향 확정 (호영님):** (다) 경로별 분리. **단 선행 수정 1건이 갈래보다 먼저다.**

---

## 0. 순서 — 정의부가 먼저다

```
1단계: 헬퍼 6개 — 내부 catch 제거 또는 rethrow. 실패가 호출부에 도달하게만 한다
2단계: 호출부 정책 — 경로별 (가) fail-closed / (나) 가시화
```

지금 구조는 헬퍼가 catch 하고 `null` 을 반환해서 **호출부가 실패를 알 방법이 없다.**
어떤 정책을 얹어도 **정책이 작동할 정보 자체가 없다.**

🛑 **소비자 146건 개별 판정을 하지 않는다.** 정의부 6개로 덮인다 —
그게 정의부 귀속 규칙의 실제 효용이다.

## 1. 🔴 tsc 파급 — **실측 0건**

6개 정의부를 전부 rethrow 로 바꾸고 측정한 뒤 되돌렸다(복원 clean 확인).

```
적용        6/6
tsc 오류    27 → 27
신규        0        (분모 = 저장소 전체·검증 자산 포함)
```

> **rethrow 는 타입에 보이지 않는다.**

`.catch()` 가 붙은 호출은 여전히 타입이 맞고, `await` 없는 호출도 마찬가지다.
`return null` 을 없애 반환 타입이 좁아져도 `if (!result)` 식 소비는 통과한다.

⚠️ **이게 이 배치의 가장 중요한 실측이다.** 파급이 없다는 뜻이 **아니라**,
파급이 **전부 런타임에만 나타난다**는 뜻이다.

- **정적 게이트(tsc)는 이 변경에 대해 0의 보호를 제공한다**
- 따라서 **실패 주입 런타임 프로브가 유일한 게이트**다
- §runtime-beats-static-gate 의 새 사례로 등재

⚠️ 측정 중 앵커 4/6 이 CRLF 로 불일치했다. 저장소 줄끝이 파일마다 섞여 있다 —
치환 배치에서 `\r?\n` 정합을 기본으로 둔다.

## 2. (가) 경로 — 호영님 경계 적용

> 판단 기준은 "규제 항목이냐" 가 아니라 **"기록이 없으면 행위를 재구성할 수 없느냐"**.

### 실측 모집단

```
헬퍼 호출부 총계 102건 / 정의부 4파일 제외한 src 전체
  createAuditLog 46 · createActivityLog 40 · createActivityLogServer 10
  · logStateTransition 6 · logCTAExecution 0
```

📌 `logCTAExecution` 은 **호출부 0**. 정의부만 있고 소비자가 없다 — 별건으로 존폐 판단.

### 분류

| | 건수 / 파일 | 비고 |
|---|---|---|
| **(가) fail-closed** | **69건 / 41파일** | 경로 패턴으로 확정 |
| (나) 가시화 | 0건 | 패턴 매칭 0 |
| 미분류 | 33건 / 18파일 | 경계 수동 적용 필요 |

🛑 **(나) 가 0 이다.** 감사 헬퍼는 조회·리포트 경로에서 거의 호출되지 않고,
**쓰기·전이 경로에 몰려 있다.** (다) 안이 실질적으로 (가) 단일에 가깝다.

(가) 69건 내역 (축별):
- **상태 전이** — `quotes/[id]/status` · `admin/orders/[id]/status` · `receiving-drafts/[id]/{approve,reject}` · `ai-actions/[id]/approve`(9) 등
- **재고 이동** — `inventory/{[id],[id]/restock,[id]/use,[id]/inspection,dispatch-batch,smart-receiving}` · `lib/ai/inventory-restock-detector`
- **권한 변경** — `organizations/[id]/{members,security,sso}` · `admin/users/invite` · `workspaces/[id]/members/[memberId]`
- **SDS·제품** — `products/[id]/{sds,inspection}` · `safety/sds/bulk/commit`
- **외부 발송** — `orders/[id]/send-email` · `quotes/[id]/{vendor-requests,vendor-replies}` · `shared-lists` · `vendor/quotes/[quoteId]/response` · `ai-actions/generate/vendor-email-draft`

미분류 33건에 경계를 적용하면 대부분 (가) 로 간다:
`admin/users/[id]/{approval,approval-policy,restore}`(권한) · `organization-vendor(-products)`(제품 정보) ·
`cron/user-soft-delete-purge`(되돌릴 수 없음) · `workspaces/[id]`(조직).
**(나) 후보는 `safety/spend/summary`·`safety-spend` 2건 정도**다.

⚠️ 이 분류는 **경로 패턴 도출**이다. 판정이 아니다 — 확정 전 호영님 확인 필요.

## 3. (나) 처리 — 큐는 이 배치 밖

재시도 큐는 인프라 작업이다. 이 배치의 중간 조치:

```
실패를 삼키지 않고 stderr + 메트릭으로 가시화만. 응답은 유지.
```

큐는 **별도 카드**로 연다.

## 4. 프로브 계획 — 실패 주입, 선언 잠금

주입 방식·대상·복원을 선언에 박고 잠근다. **선언 밖 주입은 ④ 정지.**
주입은 한 번에 하나, 주입 상태로 다른 프로브를 이어 돌리지 않는다.

| ID | 대상 | 주입 | 기대 |
|---|---|---|---|
| FIX-P1 | `quotes/[id]/status` PATCH — (가) | 헬퍼 내부 throw | **5xx** (현재 200) |
| FIX-P2 | `inventory/[id]/use` — (가) 재고 이동 | 동일 | **5xx** |
| FIX-P3 | `organizations/[id]/members` — (가) 권한 | 동일 | **5xx** |
| FIX-P4 | `safety-spend` GET — (나) | 동일 | **200 + stderr 가시화** |
| FIX-P5 | 회귀 — 주입 없이 (가) 4경로 | 없음 | 200 + 파생 델타 = **정상 기준선** |

- 정온 하한 1890ms · 판정 게이트 코드화(UNCLASSIFIED) · 계측기 자기검증 선행
- 대량 스윕과 상태 변경을 같은 실행에 넣지 않는다(풀 고갈 규칙)
- **델타는 기준선 대비로만 읽는다** — FIX-P5 로 정상 기준선을 먼저 잡는다

## 5. 롤백 경로

```
커밋 1: 정의부 6개 rethrow            ← 단독 revert 가능. 되돌리면 현 상태(삼킴)로 복귀
커밋 2: (가) 호출부 fail-closed        ← 커밋 1 없이는 무의미. 먼저 revert
커밋 3: (나) 가시화                    ← 독립
```

revert 순서는 **역순 강제**(3 → 2 → 1). 커밋 1만 되돌리면 커밋 2의 호출부가
도달 불가능한 실패 처리를 들고 남는다.

🛑 **배포 위험**: 1+2 가 함께 나가면 **감사 DB 장애 시 (가) 69경로가 동시에 5xx** 가 된다.
지금은 조용히 성공하던 것이 시끄럽게 실패한다 — 그게 의도이지만,
**감사 테이블 가용성이 곧 쓰기 경로 가용성**이 된다는 뜻이다.
이 트레이드오프는 호영님 확인 사항이다.

## 6. 이 설계안이 닫지 않는 것

- 재시도 큐 (별도 카드)
- `logCTAExecution` 존폐 (호출부 0)
- 미분류 33건 최종 귀속 (경계 수동 적용)
- 감사 테이블 자체의 가용성·이중화

## 7. 관계

- §audit-integrity-200-mask — 확진판
- §runtime-beats-static-gate — tsc 신규 0 이 새 사례
- §drift-track-scoping — D3 전에 이 수정이 끝나야 한다
