# COMMIT — §11.348-B-1 B1-3 (§11.357 해소): 안전 페이지 mock→실데이터

```
feat(safety) §11.348-B-1-3 #safety-realdata — 안전 페이지 하드코딩 mock 제거 → /api/safety/products 실조회 + 어댑터(규칙엔진 유지)
```

## 무엇 (§11.357 mock 해소 핵심)
- `/dashboard/safety` 의 하드코딩 `safetyItems`(4건) 제거 → `/api/safety/products` 실조회 + `adaptSafetyProducts` 변환. `buildSafetyDecision` 규칙엔진은 **그대로**(입력만 실데이터).

## 설계 (저위험 — id 충돌 회피)
- `SafetyItemInput.id` 는 number(엔진·페이지 state `selectedItemId`/`Set<number>`/`Map<number>` 정합). 실 Product.id 는 cuid(string) → 충돌.
- **어댑터가 로컬 index id(1..N) 부여** + `productIdByLocalId` 맵으로 실 productId 보존(SDS/액션 deep-link = B1-3b). → 엔진 타입·페이지 number-id **무변경**.
- Product 안전필드 파생(mock 대체): hasMsds(msdsUrl∨sdsDocuments) / level·isHighRisk(위험 픽토그램·hazardCode) / actionStatus(MSDS 유무) / icons(pictograms) / ppe / cas(Product 필드 없음→"").

## Fix (file별)
- 신규 `lib/safety/product-to-safety-item.ts`: 순수 어댑터(`adaptSafetyProducts`). 단위 테스트로 파생 규칙 검증.
- `dashboard/safety/page.tsx`: mock `safetyItems` 배열 제거 + `useQuery(/api/safety/products)` + `useEffect` 어댑터 sync → 기존 `items` state. 가짜 mutation(MSDS 등록/점검/폐기)·number-id·KPI·도넛·큐 **무변경**(최소 침습).

## 제약 / 한계
- READ 실데이터화 완료. **가짜 mutation(등록/점검/폐기)은 아직 로컬 state**(이전부터 mock) — 영속화는 **B1-3b**(MSDS 등록→SDS 업로드 연결, 점검→Inspection). 본 커밋 회귀 0(기존도 fake였음).
- 실 env 에서 안전필드 태깅된 Product 0건이면 빈 상태(정직). TREND_DATA(7일)는 아직 mock(별도).

## migration
- **없음.**

## 검증 (vitest)
- `safety-realdata-348b1-3.test.ts` → **6/6** (어댑터 파생 규칙 5 + 페이지 wiring).
- 회귀: 기존 안전 sentinel(291/291b/302d6d1/333/preferences-safety) **53/53 무영향**.

## Out of Scope
- B1-3b: 안전 mutation 영속화(등록→SDS 업로드, 점검→Inspection 모델). B1-4: COA 동형(coaUrl/source=coa).

## Rollback
- 신규 어댑터 + sentinel 삭제, page query/sync/mock-제거 revert. 규칙엔진·UI 무변경이라 독립.
```
footer 없음
```
