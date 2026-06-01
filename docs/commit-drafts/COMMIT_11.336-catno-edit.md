feat(inventory): §11.336 #catno-edit — 기존 재고 Cat.No 사후 편집 동선 (호영님 P1, 2026-06-01)

호영님 P1 §11.336 (GREEN) — 이미 등록된 품목에 검증된 Cat.No 를 수동 입력하는
편집 경로 신설. §11.335 데이터 투입 동선 완성.

배경 / 호영님 spec:
- §11.335 Cat.No 검색·표시 코드 완료(c054d71). 단 제품 catalogNumber 공백 → 미표시(환각방지 정합).
- 호영님 결정: 본인이 아는 검증된 Cat.No 를 운영 DB 에 수동 입력(실값 = 환각 아님).

Truth Reconciliation (진단):
- 신규 품목 등록(AddInventoryModal 신규) / 라벨 스캔(§11.326) / bulk import → catalogNumber 저장 ✅.
- 기존 재고 사후 편집 ❌ — inventory/[id] PATCH 가 catalogNumber 미수용 + AddInventoryModal
  편집모드 Cat.No 란이 readOnly(표시 only).
- 분기 판정: ❌ 편집 경로 없음 → 편집 UI + PATCH wiring 신설.

호영님 결정:
- 옵션 A (Product 직접 update) — 같은 Product 면 Cat.No 동일(제품 고유 식별자). 빈 값 채우기가 주 케이스.
- AddInventoryModal 편집모드 기존 Cat.No 란 활성화(새 화면 X, same-canvas).

Fix (file 별):

- src/app/api/inventory/[id]/route.ts:
  · PATCH body 에서 catalogNumber 구조분해 + 정규화(빈 문자열/공백 → null, 값 있으면 trim, undefined 면 변경 안 함).
  · 트랜잭션 안 — 연결 Product 마스터 catalogNumber update(옵션 A). prevCatNo !== resolved 일 때만
    write(불필요 write 회피). existingInventory.productId 사용.
  · audit newData 에 catalogNumber 반영(before/after 가시성). RBAC inventory_update enforceAction 보존.

- src/components/inventory/AddInventoryModal.tsx:
  · editableCatNo state + 편집모드 prefill(inventory.product.catalogNumber).
  · catNo input — 편집모드만 editable(readOnly={!inventory}), value={inventory ? editableCatNo : formCatNo},
    data-testid="catno-edit-input". placeholder "예: 25200-056".
  · handleSubmit 편집모드 data 에 catalogNumber: editableCatNo.trim() || null 포함. onSubmit prop 타입 확장.

- src/app/dashboard/inventory/inventory-content.tsx:
  · createOrUpdateMutation fn 타입 + edit body 에 catalogNumber: formPayload.catalogNumber.
- src/app/dashboard/inventory/inventory-main.tsx:
  · 동일(2화면 일관) — fn 타입 + edit body catalogNumber: data.catalogNumber.

저장 경로 통일 (단일 진실 Product.catalogNumber):
  품목 등록 ─┐
  재고 수정 ─┼─→ Product.catalogNumber
  라벨 스캔 ─┘

canonical truth / 제약:
- Product.catalogNumber = 단일 진실. 옵션 A 로 공유 재고에 일관 반영.
- 환각 방지(§11.335): 자동 생성 0, 사용자 입력만, 빈 값 허용(null).
- §11.326 데이터모델 무관(catalogNumber = packSize 별개 필드).
- dead button 0(input real wiring), page-per-feature 0(기존 모달 편집모드).

production effect:
- 재고 수정 모달에서 Cat.No 입력/수정 → 저장 → Product 반영 → §11.335 소싱 검색·카드에 즉시 노출.
- 빈 Cat.No 를 검증값으로 채우는 주 케이스 안전(충돌 0). 기존 값 변경 시 audit 로그 before/after.

검증 (sandbox):
- sentinel catno-edit-336.test.ts: PATCH 수용/정규화/Product update/change-only guard + 모달 편집활성화 +
  2화면 body 전달 + 회귀(기존 PATCH/RBAC 보존). 정규식 단언 16/16 PASS.
- 4파일 무결 brace/paren/eof balanced. truncation 0(delta=추가분 일치, Python 원자 치환).
- 빌드/타입체크 = 호영님 env.

Out of Scope:
- 제품 상세(§11.330) 편집란(별도). 본 batch = 재고 수정 모달 경로.
- catalogNumber 충돌(다른 Product 동일 Cat.No) 강제 정합 — 빈 값 채우기 주 케이스라 미강제.

Rollback path: git revert <SHA>
- PATCH catalogNumber 분기 + Product update 제거, 모달 catNo readOnly 복원, 부모 body catalogNumber 제거.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add "apps/web/src/app/api/inventory/[id]/route.ts" `
  apps/web/src/components/inventory/AddInventoryModal.tsx `
  apps/web/src/app/dashboard/inventory/inventory-content.tsx `
  apps/web/src/app/dashboard/inventory/inventory-main.tsx `
  apps/web/src/__tests__/regression/catno-edit-336.test.ts `
  docs/commit-drafts/COMMIT_11.336-catno-edit.md
git commit -F docs/commit-drafts/COMMIT_11.336-catno-edit.md
git push origin main
```

## Production smoke (호영님 env — E2E)
1. 재고 목록 → 품목 "수정" → Cat.No (카탈로그 번호) 란이 편집 가능(회색 아님) 확인.
2. 검증된 Cat.No(예: 25200-056) 입력 → 저장.
3. 소싱 검색(/app/search)에서 그 Cat.No 검색 → 제품 카드에 "Cat. 25200-056" 노출 확인.
4. (회귀) 기존 수량/위치/LOT 수정 정상 + 신규 품목 등록 정상.
5. 빈 Cat.No 그대로 저장 → null 유지(미표시) 확인.

## Next
- land 후 호영님 실제 Cat.No 입력 → 검색 확인 시 §11.335/336 종결.
- §11.330 제품 상세 편집란(선택, 별도).
