# RUNBOOK — catalog ingest 가동 & 승격 (조달청 공공데이터)

작성: 2026-06-20 · 대상: operator(클로드코드) / 호영님(env·인프라)
근거 코드: `src/app/api/cron/catalog-ingest/route.ts`, `src/lib/catalog/procurement-ingest.ts`, `src/lib/catalog/procurement-codes.ts`, `prisma/schema.prisma`(ProcurementCatalogRef)

---

## 0. 한 줄 요약

ingest 코드는 **이미 완성**(Phase 2/4). 제품 상세·대체품·완성도가 비어 보이는 건 코드가 아니라
**① ingest 미가동 + ② 승격(ref→product) 미실행** 때문. 둘 다 prod 작업이라 **operator/호영님 영역**
(CLAUDE.md: prod DB write·env = sandbox 금지).

---

## 1. 동작 구조 (현행 사실)

- 진입점: `GET /api/cron/catalog-ingest` — Vercel cron `0 3 * * *`(매일 03:00).
- 게이트: `CATALOG_PUBLIC_INGEST=1` **그리고** `PROCUREMENT_API_KEY` 둘 다 있을 때만 실행.
  - 하나라도 없으면 **no-op 보고**(`skipped:true`, reason `flag_disabled`/`missing_api_key`) — fake success·throw 0, cron red 0.
- 데이터 흐름: 세그먼트(12 화학·시약 / 41 실험·측정·시험장비) → Unit8로 8자리 분류코드 런타임 해석
  → 품목 페이징 fetch → transform → `db.procurementCatalogRef.upsert`(idempotent).
- **canonical 보호**: write 대상은 `procurementCatalogRef` **단독**. `db.product`는 무접촉.
- 예산: run당 `MAX_REQUESTS_PER_RUN=400`, `NUM_OF_ROWS=500`, 일일 API 1000/operation 내 보수 배분.
  day-rotation 커서(저장소 의존 0)로 전 코드(~1,108)를 며칠에 걸쳐 커버(tail starvation 방지).
- 인증(선택): `CRON_SECRET` 설정 시 Bearer 또는 `x-vercel-cron-signature` 헤더 필요.

---

## 2. 가동 절차 (호영님 env → operator 검증)

1. **(호영님) data.go.kr 서비스키 발급** — ThngListInfoService 활용신청 → `PROCUREMENT_API_KEY`.
2. **(호영님) Vercel env 설정** (production):
   - `PROCUREMENT_API_KEY=<발급키>`
   - `CATALOG_PUBLIC_INGEST=1`
   - (선택) `CRON_SECRET=<랜덤>` — cron 엔드포인트 보호.
3. **(operator) 수동 1회 dry-run 트리거** — cron 시각 기다리지 말고 인증 헤더로 GET 호출.
   - 응답 확인: `skipped:false`, `resolvedCodes`(>0), `upserted`(>0), `refSkipped`(silent drop 0 확인).
   - `skipped:true`면 env 미반영 → 1~2단계 재확인.
4. **(operator) 평이한 한국어 보고** → 호영님 "진행" 게이트 → 며칠 cron 누적(전 코드 1회전).
5. 검증 쿼리(read-only): `select count(*) from "ProcurementCatalogRef";` 증가 추세 확인.

> ⚠️ `PARAM_CLSFC`(`dtilPrdctClsfcNo`) 등 분류 파라미터 실명은 Phase 4 smoke에서 최종 확정 대상
> (`procurement-ingest.ts` 주석). dry-run에서 `upserted=0`·`refSkipped` 과다면 이 상수부터 점검.

---

## 3. 승격 (ref → product) — 값이 실제로 채워지는 지점

- `ProcurementCatalogRef.linkedProductId` = **승격 hook**(실사용 시에만 `db.product` id 연결, FK 아님).
- ingest만으로는 `procurementCatalogRef`만 쌓이고 **제품 상세/대체품/완성도(=db.product 기반)는 안 채워짐.**
- 승격은 별도 단계(promotion-on-use 아키텍처) — 자동 승격 파이프라인은 **미구현 가능성**.
  필요 시 별도 트랙으로 설계(매칭: `quote-product-match`/`bom-product-match` 재사용 가능).
- ★ 승격을 자동/대량으로 돌릴지(=db.product 대량 생성)는 **canonical 오염 리스크**가 커서
  호영님 결정 + dry-run→보고→진행 게이트 필수.

---

## 4. 의존 기능 (가동 후 자동 효과)

| 기능 | 데이터 의존 | 가동 후 |
| :--- | :--- | :--- |
| 제품 상세 완성도 %(8필드) | db.product 필드 | 승격된 제품에서 채워짐 |
| 대체품(`/api/products/[id]/alternatives`) | db.product(동일 category) | 제품 수↑ → 후보·근거↑ |
| 견적 품목 매칭(`quote-product-match`) | db.product catalogNumber | 매칭 후보↑ |

→ 상세 페이지 코드(§02-06 정직화)는 완료. **데이터가 차면 같은 렌더 규칙으로 자동 발현.**

---

## 5. Rollback / 안전

- 즉시 비활성: `CATALOG_PUBLIC_INGEST` 제거(또는 ≠1) → 다음 cron부터 no-op. 코드 revert 불필요.
- ingest는 `procurementCatalogRef`만 건드리므로 canonical(db.product) 손상 경로 0.
- 파괴적 명령(reset/force) 금지. `migrate diff --from-migrations --shadow-database-url=<prod>` 절대 금지(CLAUDE.md §9.9).

---

## 6. 책임 경계 (CLAUDE.md)

- env 설정·서비스키 = **호영님/인프라**.
- cron 수동 트리거·prod 검증·승격 apply = **operator(클로드코드) 단독**, dry-run→보고→진행.
- sandbox(Claude/Cowork): 코드·파서·sentinel·이 문서까지. prod write·env·실행은 **불가**.
