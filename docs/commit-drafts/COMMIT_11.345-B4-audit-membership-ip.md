# COMMIT — §11.345-B4 멤버십/승인요청 write단 IP 보강 (long-tail batch 3)

```
fix(audit) §11.345-B4 #audit-writeside-membership-ip — 멤버십/승인요청(결재한도·PR생성) 라우트 IP·UA 캡처 (호영님 P2)
```

## 호영님 spec (§11.345 Part B long-tail)
- 결재 한도 변경·승인 요청 생성은 거버넌스 감사 이벤트 → IP 기록.
- 작고 안전한 가산 배치 (long-tail batch 3).

## Fix (file 별)
- `app/api/organizations/[id]/members/route.ts` (PATCH approval_limit_update, MEMBER_APPROVAL_LIMIT_CHANGED): `...auditRequestMeta(request)` (changes 기보유).
- `app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts` (POST request_approval_create, PURCHASE_REQUEST_CREATED): `...auditRequestMeta(request)`.
- `app/api/workspaces/[id]/members/[memberId]/route.ts` (PATCH approval_limit_update, MEMBER_APPROVAL_LIMIT_CHANGED): `...auditRequestMeta(request)` (changes 기보유).
- `__tests__/regression/audit-writeside-membership-ip-345b4.test.ts`: sentinel.

## 진단 메모 (long-tail 현황 확정)
- **ai-actions 클러스터(approve/[id]/generate ×6)는 이미 `extractRequestMeta`로 IP 캡처 중 → 작업 불필요.**
- quotes/[id]/route, org/sso 도 기보유.
- 3개 라우트 모두 `request` 보유 → rename 불필요.

## 검증 (vitest 실행)
- membership-ip-345b4 + adminusers-ip-345b3 + orders-ip-345b2 → **10 tests passed**.

## Canonical truth 보존
- AuditLog 스키마/시그니처 무변경. 가산 param. eventType/changes/metadata 보존.

## Production effect
- 결재한도 변경/승인요청 생성 감사 레코드에 IP 기록.

## Out of Scope (잔여)
- **safety 라우트 ×3**(safety-spend / safety/spend/map / safety/spend/summary) — createAuditLog 있으나 IP 미보유. 마지막 IP 미니배치(§11.345-B5)로 남김.
- `DataAuditLog`(inventory 등) 감사 페이지 통합 여부 — 별도 결정 건.

## ⚠️ 배포 주의
- 4개 파일 한 커밋. push 전 `git status` + Vercel green.
- 누적 미푸시(이전 안내): `audit-page-mobile-311b.test.ts`(§11.337+NUL), `vsentinel.config.mjs` 루트 삭제.

## Rollback path
- 각 라우트 `...auditRequestMeta(request)` 라인 revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
