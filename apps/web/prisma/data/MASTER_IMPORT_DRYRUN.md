# 통합 제품 마스터 적재 — DRY-RUN 리포트

생성일: 2026-06-14 · sandbox(read-only/코드만) · DB 미적용
입력: `통합_seed.json` (316 레코드, 호영님 업로드본) → 정제본
`apps/web/prisma/data/master-catalog.cleaned.json`

> ⚠️ 본 리포트는 dry-run 입니다. **DB 에는 아무것도 쓰지 않았습니다.**
> 실제 적재는 operator-shell(클로드코드)이 schema 선행 변경 후 `tsx` 로 실행합니다.

---

## 1. 정제 요약 (316 → 304)

| 항목 | 값 |
|---|---|
| 입력 레코드 | **316** |
| 정제 후 제품 | **304** |
| 병합으로 흡수된 레코드 | **12** (9개 병합 그룹) |
| 고유 Vendor (한글명) | **68** |
| 제품-벤더 링크 (ProductVendor) | **284** |
| 벤더 0개 제품 (링크 없음) | **41** |
| placeholder Cat.No → null 처리 제품 | **2** |
| category 충돌 플래그 제품 | **1** |

병합은 **같은 Cat.No** 또는 **placeholder 동일 제조사** 버킷 안에서, 이름
유사도(한글 char-level Levenshtein ≥ 0.72 / 라틴 토큰 overlap ≥ 0.6 / 부분 포함)가
충분할 때만 일어납니다. 서로 다른 제품이 같은 Cat.No 를 공유하는 케이스(예:
`MCL-052` EMEM vs MEM, `HSU-0650030` 3종)는 **병합하지 않고** 별도 제품으로 보존합니다.

---

## 2. category 분포

| 원본(한글) | ProductCategory enum | 건수 |
|---|---|---|
| 시약 | `REAGENT` | **115** |
| 기구 | `TOOL` | **134** |
| 소모품 | `CONSUMABLE` *(신규 enum)* | **55** |
| **합계** | | **304** |

원본 분포(316): 시약 116 · 기구 145 · 소모품 55. 병합 흡수 12건은 모두 시약 1 +
기구 11 영역에서 발생(소모품은 흡수 0).

---

## 3. Vendor 정규화

- 원본 vendors 리스트의 고유 한글 vendor명: **68개**
- 대소문자/공백 변형 클러스터: **없음** (이미 정규화된 상태) → 68 그대로 유지
- `Vendor.id` = `mv-<sha1(name 소문자) 16hex>` (결정적). 재실행 시 동일 id → 멱등.
- 벤더명 예: `㈜라이카 코리아`, `㈜삼우에스앤티`, `㈜카스콤` …

> 제품↔벤더 링크는 **`ProductVendor`** (글로벌 catalog 관계)를 사용합니다.
> `OrganizationVendorProduct` 는 `organizationId` + `createdById`(User) 가 **필수**라
> 조직/operator 컨텍스트 없는 마스터 적재에는 부적합 → 사용하지 않습니다.

---

## 4. 병합 / 플래그된 레코드

### 4.1 병합 그룹 (9개, 12 레코드 흡수)

| # | Cat.No | 제조사 | canonical name | 흡수된 원본명 | 사유 |
|---|---|---|---|---|---|
| 1 | `30-2003` | ATCC | Eagle's Minimum Essential Medium (EMEM) | EMEM | 약어/풀네임 |
| 2 | `DH.Pip3041` | daihan | Transfer Pipette … 3ml (100/Inner Pack) | …3ml | 포장단위 표기차 |
| 3 | *(null, prove)* | Climet | Climet Model CI-1052x Prove Boll Head & Stand | Prove / Prove stand / Prove Boll Head | **placeholder 'prove' 클러스터** |
| 4 | `TL-2530` | (Korea Ace / Electronics Tomorrow) | **디지털타이머** | 디지텉타이머 / 디지털타미머 | **한글 오타 클러스터 ×3** (mfr 표기차 bridged) |
| 5 | `ka11-26` | (Kroea ace / Korea Ace) | 스텐선 시험관대(5부 50홀) | 스텐선시험관대(5/50) | 한글 표기차 + mfr 오타(Kroea) |
| 6 | `CI-95A` | Climet | Climet Model CI-95 Microbial sampler | …CI-95A Microbial Samper | 오타(Samper) |
| 7 | `CI-95` | Climet | Air sampler | Air sampler ( 부유균 측정기) | 한글 부연 |
| 8 | `CI-1052x` | Climet | Particle counter ( 부유입자 측정기) | 부유입자측정기 | 한/영 동일품 |
| 9 | `CI-3100` | Climet | PMS (Climet Model CI-3100RS particle counter Cal) | PMS | 약어/풀네임 |

- canonical name 은 **가장 중심적인 철자**(클러스터 내 편집거리 합 최소) + 영문/길이/대장출처
  가중으로 선택 → 오타 #4 는 올바른 "디지털타이머" 로 정규화됨.
- 흡수된 원본명 전체는 각 제품 `specifications.mergedFrom` 에 보존, 플래그
  `importFlags: ["merged-cluster"]` 부여.

### 4.2 placeholder Cat.No → null + 플래그 (2제품)

| id | name | 처리 |
|---|---|---|
| `mp-c5cf464be077d013` | 5x loading buffer | catalogNumber=null, `importFlags:["placeholder-catalog-null"]` (원본 Cat.No=null 1건) |
| `mp-b901a9cb4edd1589` | Climet Model CI-1052x Prove Boll Head & Stand | catalogNumber=null + `["placeholder-catalog-null","merged-cluster"]` (원본 'prove' ×4 → 1제품) |

원본 'prove' placeholder 4건은 모두 Climet CI-1052x prove 구성품 → 1제품으로 병합 후 null 처리.

### 4.3 category 충돌 플래그 (1제품)

| id | name | 충돌 | 처리 |
|---|---|---|---|
| `mp-595a859c5dcf30c8` | Transfer Pipette … 3ml (100/Inner Pack) | 소모품 ↔ 기구 | canonical(대장) 기준 `CONSUMABLE` 채택, `specifications.categoryConflict:["소모품","기구"]` 로 흔적 보존 |

---

## 5. 필드 매핑 표

| 원본 필드 | Prisma 대상 | 비고 |
|---|---|---|
| `name` | `Product.name` | canonical name (병합 시 대표명) |
| `manufacturer` | `Product.manufacturer` | 원본 표기 보존 (정규화는 매칭에만 사용) |
| `storage` | `Product.storageCondition` | |
| `catalogNumber` | `Product.catalogNumber` | **비-unique**. placeholder→null |
| `category` | `Product.category` (enum) | 시약→REAGENT, 기구→TOOL, 소모품→**CONSUMABLE** |
| `grade` (A~E 내부등급) | `Product.specifications.internalGrade` | **Prisma `grade`(HPLC/GMP) 에는 넣지 않음** (의미 상이) |
| `testItem` (QC 시험항목) | `Product.specifications.testItem` | 바이오 핵심, 316 전부 보존 |
| `years` | `Product.specifications.purchaseYears` | 병합 시 union |
| `src` (구매/대장) | `Product.specifications.source` | 병합 시 union |
| `vendors` (한글명 list) | `Vendor` upsert + `ProductVendor` 링크 | 중복 제거, 0개면 링크 없음 |
| *(merge 흔적)* | `Product.specifications.mergedFrom / importFlags / categoryConflict` | dedupe audit |

`Product.id` = `mp-<sha1(catalogNumber|normName 또는 PH|mfr|normName) 16hex>` (결정적, cuid 패키지 미사용).

---

## 6. schema 선행 변경 (operator-shell 필수)

스크립트는 `CONSUMABLE` 를 emit 하지만 현재 enum 에는 없습니다. **적재 전** enum 추가 + migration 이 선행돼야 합니다.

### 6.1 schema diff

`apps/web/prisma/schema.prisma`:

```diff
 enum ProductCategory {
   REAGENT // 시약
   TOOL // 기구
   EQUIPMENT // 장비
   RAW_MATERIAL // 원료(원부자재)
+  CONSUMABLE // 소모품
 }
```

### 6.2 migration 노트 (operator-shell, dry-run → "진행" 게이트)

PostgreSQL enum 값 추가는 비파괴(append-only)입니다. 기존 데이터 영향 없음.

```bash
# operator-shell (클로드코드) 단독. sandbox 금지.
# 0) project-ref echo 확인 (CLAUDE.md 파괴적-아님이지만 prod 변경이므로 보고 후 진행)
# 1) schema.prisma 에 위 diff 적용
# 2) dry-run: 생성될 SQL 확인 (read-only, --from-url 사용 / --shadow-database-url 금지)
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel apps/web/prisma/schema.prisma \
  --script
#   → 기대 SQL: ALTER TYPE "ProductCategory" ADD VALUE 'CONSUMABLE';
# 3) 호영님 "진행" 후 적용:
npx prisma migrate dev --name add_consumable_category   # local
#   또는 prod: npx prisma migrate deploy
# 4) client 재생성
npx prisma generate
```

> 🛑 `migrate diff --from-migrations --shadow-database-url=<prod>` 절대 금지(2026-06-14 사고, DEV_RUNBOOK §9.9).

---

## 7. 적재 절차 (operator-shell)

```bash
# schema CONSUMABLE 반영 + generate 완료 후
npx tsx apps/web/prisma/import-master-catalog.ts
```

- 멱등(upsert by id). 재실행해도 중복 0.
- `deleteMany` 전체 wipe 없음 → 기존 seed 9제품/벤더 보존.
- 순서: Vendor 68 upsert → Product 304 upsert → ProductVendor 284 링크 upsert.

---

## 8. 적재 검증 쿼리 (operator-shell, read-only count)

적재 전후 증가분 확인:

```sql
-- 마스터 제품 수 (mp-* prefix)
SELECT count(*) FROM "Product" WHERE id LIKE 'mp-%';      -- 기대: 304
-- 마스터 벤더 수 (mv-* prefix)
SELECT count(*) FROM "Vendor"  WHERE id LIKE 'mv-%';      -- 기대: 68
-- 마스터 링크 수 (mpv-* prefix)
SELECT count(*) FROM "ProductVendor" WHERE id LIKE 'mpv-%'; -- 기대: 284
-- category 분포
SELECT category, count(*) FROM "Product" WHERE id LIKE 'mp-%' GROUP BY category;
--   REAGENT 115 / TOOL 134 / CONSUMABLE 55
-- 기존 seed 보존 확인 (감소 0)
SELECT count(*) FROM "Product" WHERE id NOT LIKE 'mp-%';  -- 기존 9 유지
```

또는 Prisma:

```ts
await prisma.product.count({ where: { id: { startsWith: "mp-" } } }); // 304
await prisma.vendor.count({ where: { id: { startsWith: "mv-" } } });  // 68
await prisma.productVendor.count({ where: { id: { startsWith: "mpv-" } } }); // 284
```

---

## 9. 데이터 이슈 / 주의점

1. **Cat.No 공유(distinct)**: 같은 Cat.No 를 쓰는 서로 다른 제품 다수 → unique 키 금지(준수). 병합은 이름 유사도 게이트로만.
2. **mfr 표기 오타/대소문자**: `Kroea ace`, `sigma/SIGMA`, `daihan/DAIHAN` 등. 원본 보존하되 매칭은 normalize. TL-2530/ka11-26 은 mfr 표기가 달라도 Cat.No+이름유사로 병합됨.
3. **한/영 동일품**: 대장(영문) vs 구매(한글) 같은 제품을 다르게 기재한 케이스가 병합의 다수.
4. **category 충돌 1건**: 소모품↔기구. 충돌은 플래그로 보존, 운영에서 재검토 권장.
5. **벤더 0개 41제품**: 링크 없이 제품만 적재(정상).
6. **EQUIPMENT/RAW_MATERIAL 미사용**: 본 마스터에는 해당 카테고리 원본 없음.
7. **internalGrade vs grade 분리 준수**: A~E 는 specifications.internalGrade 로만. Prisma `grade` 미사용.
