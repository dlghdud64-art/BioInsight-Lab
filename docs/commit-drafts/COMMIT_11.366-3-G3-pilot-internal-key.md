# COMMIT — §11.366 G-3: pilot 내부키 일괄 정리 (옵션 A — cuid 자연키 전환)

```
fix(pilot) §11.366 G-3 #pilot-internal-key — pilot 시드 내부키(inv-pilot-*·order-pilot-*·ORD-PILOT·#P01 ADR-002 조직/워크스페이스명) 제거: upsert 키를 자연키로 이전해 id cuid 자동화 + 데모명/발주번호 정상화
```

## 무엇 (§11.366 G-3 — 호영님 P1, soft launch 런칭 게이트)
- pilot 시드의 human-readable 내부키가 export 바코드·D-8 상세 "고유 식별자"·조직명·발주번호로 노출 → 데모 데이터가 실데이터처럼 보임(외부 공개 전 클리어 필수).
- 환경: soft launch(외부 사용자 0) → 전체 클린 재시드 안전. **호영님 dry-run→진행 게이트 통과.**

## 결정 (옵션 A — 호영님 확정)
- inv/order가 `upsert(where:{id})` = deterministic id가 idempotency 장치. cuid화 = 키 전략 변경 필요.
- **(A)**: upsert 키를 자연키로 이전(inv `@@unique([organizationId,productId])`, order `orderNumber @unique`) → id 미지정 = **cuid 자동**. idempotent re-run 보존 + 스키마 변경 0 + 시드 아키텍처 유지(최소 diff). (B create 전환 대비 우월.)
- ⚠️ **수정 이력**: order 키를 초기 `quoteId`로 잡았으나 schema 재확인 결과 `quoteId`는 `[quoteId,vendorId]` 복합 unique라 단독 upsert 불가 → `orderNumber @unique`로 교정(호영님 발견·적용).

## Fix
- `pilot.ts`:
  - PILOT_ORG_NAME `Pilot Internal Org (#P01 ADR-002)` → `데모 연구소`.
  - PILOT_WORKSPACE_NAME → `데모 워크스페이스`.
  - PilotInventorySpec/PilotOrderSpec `id` 필드 제거 + CATALOG `inv-pilot-*`·`order-pilot-*` id 제거.
  - orderNumber `ORD-PILOT-2026-0001` → `ORD-2026-0001`.
  - PILOT_INVENTORY_IDS·PILOT_ORDER_IDS export 폐기(id 소멸로 dead, cleanup=org/quote cascade).
  - (id/slug `org-pilot-internal` = 미노출 내부값 → 보존, 과변경 0.)
- `pilot-seed.ts`:
  - inv upsert `where:{id}` → `where:{organizationId_productId:{...}}`, create `id` 제거.
  - order upsert `where:{id}` → `where:{orderNumber}`(@unique), create `id` 제거.
- **product/vendor/quote PK(`product-pilot-*` 등) 보존**(미노출 내부 PK — 과변경 0).
- 테스트 `pilot-seed-quote-inventory.test.ts`: 폐기 상수 import 제거 + `order-pilot-`/`ORD-PILOT-` 단언 → cuid·`ORD-2026` 정합.

## 적용 절차 (호영님 Claude Code — DB 게이트 통과 후)
```
cd apps/web
npx tsc --noEmit && npm run lint && npm run test   # 코드+갱신 테스트 검증
npx tsx scripts/pilot/pilot-cleanup.ts --apply     # 기존 inv-pilot-* 등 org cascade 삭제
npx tsx scripts/pilot/pilot-seed.ts --apply        # cuid 재생성 (데모명/ORD-2026)
git add ... && git commit && git push
```

## canonical truth — 시드/실데이터 경계
- 호영님 확정: 전체 클린 재시드(보존 실데이터 0). cleanup(org cascade) → 재시드.

## 검증
- sentinel `pilot-internal-key-removed-366g3`: inv-pilot/order-pilot/ORD-PILOT/Pilot Internal(#) 0 + 데모명·ORD-2026 + 자연키 upsert + product/vendor/quote PK 보존. ⚠️ vitest = Claude Code.
- 재시드 후 Chrome(호영님): export 바코드·D-8 식별자·조직명·발주번호 내부키 0, 대시보드/재고 정상 렌더.

## 다운스트림
- export 바코드/D-8 식별자 → cuid 자동 정상. §11.355-B QR 라벨 stale(실물 미사용 → 무영향). 발주번호/조직명 표시 정상화.

## Rollback
- pilot.ts/pilot-seed.ts revert + 수정 전 시드로 재시드. 외부 사용자 0이라 리스크 낮음.
```
footer 없음
```
