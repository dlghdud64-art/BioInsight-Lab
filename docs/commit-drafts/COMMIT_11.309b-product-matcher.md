# §11.309b Commit Message Draft (품목 매칭 로직)

```
feat(inventory): §11.309b #product-matcher — 스마트 입고 4-tier 품목 매칭 로직 (catalog → fuzzy → 신규) + unit test (호영님 P0 2026-05-26)

호영님 P0 spec (2026-05-26):
스마트 입고 backend MVP Phase B — OCR 추출 데이터 (LabelParseResult /
ParsedQuoteLineItem) 를 기존 Product 와 매칭하는 단일 책임 lib.
catalog 정확 매칭 (최우선) → fuzzy (productName/brand substring) →
신규 권장 의 4-tier 분기.

§11.309b 진입 조건 (충족):
- §11.309a-hotfix Vercel READY 확인 (sha 780b7358)
- Product schema (line 255~) — name/brand/catalogNumber 필드 확인
- DB 변경 0 — 신규 lib + unit test 만, schema migration 부재

설계 결정:
- Dependency injection — caller 가 Prisma client 또는 mock 주입
  (sandbox vitest 호환, 실 DB 없이 unit test 가능)
- 4 tier:
  · exact_catalog_brand (catalog + brand 모두 정합) → confidence 0.95
  · exact_catalog (catalog 만 정합, brand 부재/mismatch) → confidence 0.85
  · fuzzy_name (productName/brand substring) → confidence 0.4~0.6
  · new (매칭 0) → confidence 0
- normalize: trim + lowercase, catalog 에는 hyphen/space 제거 normalize 도
  정의 (MVP 는 raw 매칭 만, normalized 는 후속 §11.309b-2 에 generated
  column 또는 raw query 로 확장 가능)

Fix (2 file 신규):

- apps/web/src/lib/inventory/product-matcher.ts (NEW, ~150 line):
  · ProductMatchInput / ProductMatchType / ProductMatchResult /
    ProductCandidate / ProductMatcherDb interface export
  · matchProduct() async function:
    - Tier 1/2: catalogNumber 정확 매칭 (raw) + brand 정합 시 격상
    - Tier 3: productName + brand fuzzy (OR + substring + take 5)
    - Tier 4: new
  · normalizeKey / normalizeCatalog helper (whitespace + hyphen 흡수)
  · DB 호출 최소화 (입력 모두 null/empty 시 DB 호출 0)

- apps/web/src/lib/inventory/__tests__/product-matcher.test.ts (NEW, ~250 line):
  · Tier 1 exact_catalog_brand 2 it (정확 매칭 + case insensitive)
  · Tier 2 exact_catalog 3 it (brand 부재 / mismatch / DB brand null)
  · Tier 3 fuzzy_name 3 it (productName 만 / 둘 다 / take 5)
  · Tier 4 new 3 it (매칭 0 / input null / input empty whitespace)
  · Edge case 2 it (whitespace trim / catalog 매칭 후 fuzzy skip)
  · 총 13 it — vi.fn() mock 으로 DB 호출 검증

canonical truth 보존 (회귀 0):
- Product / ProductInventory schema 변경 0
- §11.309a InventoryRestock ocrJobId/extractedData 변경 0
- §11.290 OCR pipeline (image-storage / cloud-vision / claude-structurer)
  변경 0
- 기존 inventory matcher / search 로직 변경 0
- 신규 lib 만 — caller (§11.309c API route) 추가 시 호출

호영님 production effect (§11.309b 자체):
1. DB schema 변경 0
2. UI 변화 0 (lib 단독, caller 추가는 §11.309c 에서)
3. Vercel build TypeScript 정합 (회귀 0)
4. 신규 lib 사용 가능 — §11.309c API route 가 호출

§11.309 시리즈 진행:
- §11.309a ✅ schema + Claude invoice 프롬프트
- §11.309a-hotfix ✅ ParsedQuoteVendor shape
- §11.309b ✅ 본 batch (품목 매칭 로직 P0)
- §11.309c ⏳ /api/inventory/smart-receiving route 신규
- §11.309d ⏳ SmartReceivingScannerModal + §11.308a placeholder swap

Out of Scope:
- Catalog normalize (hyphen/space) 의 DB level 매칭 (§11.309b-2 후속)
- ProductInventory 매칭 (org filter) — caller 책임 (§11.309c)
- 벡터 임베딩 기반 semantic 매칭 (MVP 외, embedding pgvector 추가 검토)
- 다국어 productName 매칭 (current: 영문/한글 native lowercase)

Rollback path: git revert <SHA>
- 2 file 신규 삭제만 — 기존 코드 영향 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/lib/inventory/product-matcher.ts `
  apps/web/src/lib/inventory/__tests__/product-matcher.test.ts `
  docs/commit-drafts/COMMIT_11.309b-product-matcher.md

git commit -F docs/commit-drafts/COMMIT_11.309b-product-matcher.md
git push origin main
```

## Production smoke

1. Vercel build PASS (TypeScript 정합 + sentinel test 통과)
2. 신규 lib import 가능 (`@/lib/inventory/product-matcher`)
3. 기존 inventory 페이지 / 재고 UI 영향 0
4. Anthropic API / Vercel Blob 호출 0 (caller 추가 §11.309c 까지)
```
