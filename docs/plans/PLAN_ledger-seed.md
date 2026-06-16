# PLAN: §ledger-seed — PurchaseRecord 지출 시드 (멱등·충돌 안전)

- Status: ⏳ 설계 락(prod 쿼리 1건 대기) — 코드 미작성
- Date: 2026-06-16
- Owner: 호영 (총괄관리자)
- Governance: labaxis-bug-hunter (Truth Reconciliation) + ADR-002 규율 상속
- Related: ADR-002(pilot tenant seed), ADR-001(isolated WRITE DB), `apps/web/scripts/pilot/*`

---

## 0. Truth Reconciliation (확정)

- 지출 소스 모델 = **`PurchaseRecord`**(schema.prisma:989), NOT `Purchase`/`Order`. 대시보드 `monthlySpending`/`thisMonthPurchaseAmount`/`recentPurchases` 가 여기서 파생.
- 라이브 ₩71.6M(이번달 ₩10.81M) = PurchaseRecord 행. **ADR-002 pilot seed 산물 아님**(pilot-seed.ts는 org/workspace/member/product/vendor/quote/inventory/order만, **PurchaseRecord 0**).
- 호영 `young a` = org 없음 → 지출 행의 `scopeKey` = **guestKey**(`scopeKey: guestKey for MVP, workspaceId for future`).
- ⇒ ₩71.6M 출처 **미문서화**. prod read 없이 정체 확정 불가(sandbox 금지).

**충돌 키 정정 (중요):** `PurchaseRecord`에 `@@unique` 없음(id PK만). → catalogNo+manufacturer **upsert 키로 불가**. ADR-002 패턴대로 **deterministic sentinel `id`** 로 upsert해야 멱등(재실행 no-op). 자연키 추정 금지.

---

## 1. 시드 전 필수 prod 쿼리 (operator, read-only) — 분기점

```sql
-- ₩71.6M 정체 + 시드 scopeKey 충돌 여부
SELECT "scopeKey",
       count(*)                AS n,
       sum("amount")           AS total_krw,
       min("purchasedAt")      AS first_at,
       max("purchasedAt")      AS last_at,
       count(DISTINCT "source") AS src_kinds
FROM "PurchaseRecord"
GROUP BY "scopeKey"
ORDER BY total_krw DESC;

-- 표본(sentinel vs 실데이터 패턴 판정용)
SELECT id, "scopeKey", "purchasedAt", "vendorName", "itemName", amount, source
FROM "PurchaseRecord"
ORDER BY "purchasedAt" DESC
LIMIT 20;
```

### 분기 판정 (락)
| 시그널 | sentinel 시드 추정 | 실데이터 추정 |
|---|---|---|
| `scopeKey` | 단일(호영 guestKey/테넌트) | 분산/실유저 혼재 |
| `id` 패턴 | 규칙적/접두사 | 무작위 cuid |
| `purchasedAt` | 좁은 범위·동시각 | 자연 분산 |
| `amount` | 라운드/반복 | 불규칙 |
| 처리 | **exact-key delete → 시드** | **upsert-merge, truncate 금지** |

**시드 scopeKey 결정:** §ledger-seed의 PurchaseRecord는 어느 scopeKey에 심을지 먼저 고정(호영 guestKey vs pilot workspaceId). 기존 ₩71.6M과 **같은 scopeKey면 충돌 위험** → 같은 sentinel id면 upsert로 흡수(중복 0), 다른 id면 2배 → truncate 선행.

---

## 2. 3 게이트 (락 — ADR-002 상속)

1. **Guard-first:** `assertPilotDatabaseTarget()` 재사용(opt-in 토큰 + allow-list project-ref + `DATABASE_URL_PILOT`). Prisma 인스턴스화 전 guard 통과 필수. 세션 풀러(:5432) — `$transaction` 정합.
2. **Deterministic id upsert (blind insert 금지):** PurchaseRecord 514행 각각 `pr-ledger-pilot-2026-NNNN` 류 고정 id. `tx.purchaseRecord.upsert({ where:{id}, create, update })`. 재실행 = no-op(중복 적층 0). catalogNo+manufacturer 자연키 사용 금지(unique 없음).
3. **2배 assert:** 시드 후 `SELECT sum(amount) FROM "PurchaseRecord" WHERE "scopeKey"=<seed scope>` == **예상 합**(기존 disjoint면 기존+pilot, same-id면 pilot만). 불일치 시 abort + 로그.

---

## 3. Cleanup parity (ADR-002 pilot-cleanup 패턴)

- `ledger-cleanup`: deterministic id 목록 exact-key `delete`(deleteMany/LIKE 금지). **dry-run default**, `--apply` 게이트. probe-then-delete. 실데이터 보호 — sentinel id 외 절대 미접근.

---

## 4. Out of Scope / 가드

- 실데이터(real PurchaseRecord)는 절대 수정/삭제 금지 — sentinel id 한정.
- canonical user/org 미생성(ADR-002 §4 상속).
- 시드 scopeKey가 실유저 scopeKey와 겹치면 **시드 보류 + 호영 확인**(오염 위험).
- prod 쿼리 §1 결과 전 시드 실행 금지.

---

## 5. 실행 순서 (prod 쿼리 후)

1. operator §1 쿼리 → scopeKey 분포·id/amount 패턴 회신.
2. 분기 판정(§1 표) → truncate-then-seed vs upsert-merge 확정.
3. 본 PLAN으로 `scripts/pilot/ledger-seed.ts` + `ledger-cleanup.ts` + sentinel(guard·dry-run·id-scoping) 작성.
4. smoke DB 검증 → operator prod dry-run → "진행" 게이트 → apply.

**현재 차단점 = §1 쿼리의 `scopeKey` 분포 한 줄.** 그것만 오면 §5-2부터 즉시 진행.
