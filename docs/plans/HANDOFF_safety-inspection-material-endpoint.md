# HANDOFF: 물질 대표 점검 저장 엔드포인트 (P4b, operator)

> §safety-modal-upgrade P4b · 호영님 2026-07-04 · 클로드코드(operator) 실행분
> 선행: P4a UI(safety/page.tsx 점검 모달) 이미 워킹트리 완료 — 물질 대표 배지·이상→심각도3단·사진·조치 · 제출은 정직-disabled(엔드포인트 배선 후 enable).
> 기준 패턴: 기존 lot 엔드포인트 `src/app/api/inventory/[id]/inspection/route.ts` (auth→enforceAction→owner/org check→$transaction(create+lastInspected+audit)).

---

## 0. 목표
물질(Product) 단위 안전 점검을 실제 저장. 현재 `Inspection` 모델은 inventoryId(lot) 전용 → 물질 단위 경로 부재라 UI 제출이 정직-disabled 상태. 이걸 배선해 활성화.

## 1. 스키마 (additive · 무손실 · dry-run→평이한 한국어 보고→"진행" 후 apply)
`Inspection` 모델 확장:
- `productId String?` + `product Product? @relation(...)` (물질 단위 점검)
- `inventoryId String?` 로 **nullable 전환**(기존 lot 점검=inventoryId, 물질 점검=productId). ⚠ 기존 NOT NULL→NULL 은 무손실이나 마이그레이션 검토.
- `severity String?` (minor | attention | urgent)
- `photoUrl String?` (증빙 사진, 선택)
- 인덱스 `@@index([productId])`

`Product` 모델:
- `lastInspectedAt DateTime?` 없으면 additive 추가(안전 어댑터 `lastInspection` 파생 소스).

🛑 파괴적 명령 금지. `migrate diff --from-url`(read-only)만. shadow-db=prod 절대 금지(DEV_RUNBOOK §9.9).

## 2. 엔드포인트 `POST /api/products/[id]/inspection`
lot route 를 mirror:
1. `auth()` → 401 if !session.user.id
2. `enforceAction({ action: 'inventory_update' 또는 안전 전용 액션, targetEntityType:'product', targetEntityId:id, routePath:'/api/products/[id]/inspection' })` → deny()
3. `db.product.findUnique({ where:{id}, select:{id,userId,organizationId} })` → 404
4. owner OR org-member 체크(lot route 의 isOwner/isOrgMember 분기 그대로 mirror) → 403
5. 입력: 사진 있으면 multipart(FormData), 없으면 JSON. 필드: `inspectedAt`, `storageOk`, `ppeOk`, `hasIssue`, `severity`, `actionTaken`, `photo(file?)`.
   - 검증: `hasIssue===true` → `actionTaken` 비어있으면 400, `severity ∈ {minor,attention,urgent}` 아니면 400.
6. `result` 파생: `hasIssue ? (severity==="urgent" ? "FAIL" : "CAUTION") : "PASS"`.
7. 사진: SDS 업로드 저장 패턴 재사용(공용 blob) → photoUrl. (사진 저장 복잡하면 1차는 photo 없이, photoUrl 후속.)
8. `db.$transaction`:
   - `tx.inspection.create({ data: { productId:id, userId:session.user.id, organizationId, result, checklist:{storageOk,ppeOk,hasIssue}, severity, notes:actionTaken||null, photoUrl } })`
   - `tx.product.update({ where:{id}, data:{ lastInspectedAt: inspectedAt? new Date(inspectedAt): new Date() } })`
   - `createAuditLog({ userId, organizationId, action:CREATE, entityType:INSPECTION, entityId:created.id, newData:{result,severity,checklist,notes}, ip,ua }, tx)`
9. `enforcement.complete({})` · 201 `{inspection}`. catch → `enforcement?.fail()` · 500.
- **inspector = 세션 유저(canonical, 서버 기준).** 클라 inspector 필드는 표시·override용, 신뢰 소스 아님.

## 3. 클라이언트 배선 (safety/page.tsx)
- `handleInspSaveMaterial`: productId = productIdByLocalId(inspTarget.id) → POST(multipart if inspPhoto) → 성공 시 `safetyQuery.refetch()` + toast + `setInspDialogOpen(false)`. 실패 시 error toast(가짜성공 금지).
- 제출 버튼(현재 정직-disabled) 교체:
  ```
  <Button size="sm" onClick={handleInspSaveMaterial}
    disabled={inspSaving || (inspForm.hasIssue && (!inspForm.actionTaken.trim() || !inspForm.severity))}
    ...>점검 기록 저장</Button>
  ```
  (§safety-modal-upgrade P4b 주석 위치에 배선)
- inspector 자동채움: `useSession()`(next-auth) 추가해 openInspDialog 시 `inspector: session.user.name` prefill + "변경" 링크. (또는 서버 canonical만 쓰고 필드는 read-only 표시)

## 4. 테스트 (TDD)
- integration: POST 201 · Product.lastInspectedAt 갱신 · audit INSPECTION 생성 · hasIssue&&severity 누락 400 · 비인가 401/403.
- sentinel 갱신: safety-modal-upgrade-p4 에 "제출 enable + handleInspSaveMaterial 배선" 추가(현 정직-disabled 단언은 P4b 후 반전).
- 회귀: lot 엔드포인트(/api/inventory/[id]/inspection) 무접촉.

## 5. Rollback
- 스키마 additive → revert(nullable 컬럼 drop). 배선 실패 시 제출 버튼 정직-disabled 복귀(P4a 상태).
- 사진 저장 문제 시 photo 없이 텍스트 점검만 우선 배포.

## 6. 완료 정의
- 물질 점검 저장→목록 최근점검 즉시 갱신 · 감사로그 · 제출 no-op/fake 0 · tsc EXIT 0 · sentinel green → 커밋·푸시.
