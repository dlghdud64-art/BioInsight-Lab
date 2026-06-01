chore(data): §11.336-data #catno-master-import — 통합 제품/벤더 import 스크립트 (호영님 P1, 2026-06-01)

호영님 P1 §11.336-data — 검증된 실거래 데이터(시약관리대장 + 구매신청내역) 286 Product /
68 Vendor / 269 ProductVendor 를 운영 DB 에 투입하는 dry-run 내장 import 스크립트.

배경 / 호영님 spec:
- §11.335 Cat.No 검색 코드 완료(c054d71). §11.336 편집 UI GREEN. 단 제품 데이터 catalogNumber 공백.
- 본인 보유 검증된 Cat.No + 벤더 마스터를 일괄 투입 → §11.335 검색 + §11.318 벤더 추천 데이터원.

Truth 구조 (reconciliation 완료):
- canonical truth = Prisma. Product 단일 테이블(category enum), catalogNumber DB 필드,
  벤더 = Vendor + ProductVendor 조인. 온톨로지는 메타 라벨(데이터 store 아님).
- 직삽/upsert = 정규 경로(온톨로지 우회 아님).

데이터 전처리 (dry-run 1·2차, sandbox):
- 입력 316 → Cat.No 없음 skip 1(5x loading buffer) → 매칭대상 315.
- Cat.No 내부중복 23그룹 merge(긴 이름 채택, vendor 합집합) → 고유 Product 286.
  · 애매 2건(MCL-052 / 30-2003) 웹검증 → 동일제품 표기변종 확정(Serana/ATCC 공식 카탈로그).
- enum 매핑: 시약→REAGENT 111 / 기구→TOOL 124 / 소모품→RAW_MATERIAL 51 (호영님 옵션 A).
- Vendor 68. ProductVendor 269. 벤더 0개 Product 40(전부 시약대장 출처 — 등록만, 검색 미노출,
  §11.336 편집으로 추후 벤더 보강 가능 = 호영님 결정 A).

Fix (file):
- apps/web/scripts/import-catno-master.ts (신규):
  · DRY-RUN 기본(쓰기 0) / --apply 플래그로만 실제 upsert. make-admin.ts 패턴(dotenv+DIRECT_URL).
  · Vendor: name insensitive 일치 재사용 / 없으면 create.
  · Product 매칭 3단계:
    1. catalogNumber 정확일치(insensitive) → 재사용(Product.catalogNumber unique 제약 없음 → findFirst).
    2. name+manufacturer 일치 & 기존 Cat.No 빈값 → 채우기(§11.336 옵션 A).
    3. 매칭 0 → 신규 create(name/category/catalogNumber/manufacturer/brand/grade).
    · name+mfr 일치하나 기존 Cat.No 가 다른 값 → 덮어쓰지 않고 신규 처리(충돌 보존, 카운트).
  · ProductVendor: @@unique([productId,vendorId]) upsert 동반(검색 hasVendorEvidence 조건).
  · 환각 방지: price/leadTime null(추측 0). 전부 실거래 데이터.
- apps/web/scripts/catno-master-prepared.json (신규): merge 적용된 286 Product 전처리본(스크립트 입력).

canonical truth / 제약:
- Product.catalogNumber = 단일 진실. 기존 Cat.No 덮어쓰기 안 함(빈값 채우기만 + 충돌은 신규 보존).
- production DB 변경 = dry-run → 호영님 보고 → "진행" 후에만 --apply (통제구조 준수).
- migration 0(기존 스키마 사용). soft data 투입.

검증:
- 스크립트 TS 문법 tsc transpile 통과(@prisma/dotenv 모듈 해결 외 syntax 에러 0).
- dry-run 2차 sandbox 산출: Product 286 / Vendor 68 / ProductVendor 269 / 벤더0개 40 / skip 1.
- 실제 prod 매칭(기존 Product 충돌/재사용) = 호영님 env dry-run 에서 확정.

Out of Scope:
- 벤더 0개 40건 ProductVendor(데이터 없음 — 추후 §11.336 편집 보강).
- price/leadTime(데이터 없음 — null).
- CONSUMABLE enum 신설(소모품→RAW_MATERIAL 매핑으로 대체, migration 회피).

Rollback path:
- 스크립트는 git revert(파일 삭제). 데이터는 --apply 전까지 변경 0.
- --apply 후 롤백 필요 시 created Product/Vendor/ProductVendor id 기준 별도 정리 스크립트(생성 로그 보존 권장).

## 실행 (호영님 env)
```powershell
cd C:\Users\young\ai-biocompare\apps\web
# 1) DRY-RUN — 기존 DB 매칭/신규/충돌 실제 건수 보고 (쓰기 0)
npx tsx scripts/import-catno-master.ts
# 2) 건수 확인 후 실제 적용
npx tsx scripts/import-catno-master.ts --apply
```

## Push (스크립트/데이터 파일)
```powershell
cd C:\Users\young\ai-biocompare
git add apps/web/scripts/import-catno-master.ts `
  apps/web/scripts/catno-master-prepared.json `
  docs/commit-drafts/COMMIT_11.336-data-import.md
git commit -F docs/commit-drafts/COMMIT_11.336-data-import.md
git push origin main
```

## Production smoke (호영님 env — E2E)
1. dry-run 실행 → Product(재사용/채우기/신규) + Vendor + ProductVendor 건수 보고 확인.
2. 건수 합당하면 --apply.
3. 소싱 검색(/app/search) Cat.No(예: ICHRBC5P) → 제품 카드 + vendor evidence 노출 확인.
4. §11.318 벤더 추천에 데이터 반영 확인.
5. (회귀) 기존 제품/재고 영향 0 확인.

## Next
- --apply 후 §11.335/336/336-data 종결.
- 벤더 0개 40건 보강 + price/leadTime 데이터 확보 시 2차 import.
