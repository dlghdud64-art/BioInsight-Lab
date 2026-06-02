# COMMIT — §11.345-B3 admin/users 클러스터 write단 IP 보강 (long-tail batch 2)

```
fix(audit) §11.345-B3 #audit-writeside-adminusers-ip — 사용자 관리(invite/approval/restore/reject) 라우트 IP·UA 캡처 (호영님 P2)
```

## 호영님 spec (§11.345 Part B long-tail)
- 사용자 관리 변경(USER_CREATED/UPDATED/DELETED)은 21 CFR Part 11 핵심 감사 이벤트 → IP 기록 우선순위 높음.
- 작고 안전한 가산 배치 (long-tail batch 2). admin/users 클러스터.

## Fix (file 별)
- `app/api/admin/users/invite/route.ts` (POST user_invite, USER_CREATED): `...auditRequestMeta(request)`.
- `app/api/admin/users/[id]/approval/route.ts` (POST manual_approval, USER_UPDATED): `_request`→`request` + IP.
- `app/api/admin/users/[id]/restore/route.ts` (POST user_restore, USER_UPDATED): `_request`→`request` + IP.
- `app/api/admin/users/[id]/route.ts` (DELETE user_reject, USER_DELETED): `_request`→`request` + IP.
- `__tests__/regression/audit-writeside-adminusers-ip-345b3.test.ts`: sentinel.

## 진단 메모
- approval-policy 는 §11.345-B 에서 이미 IP 보강 완료 → 제외.
- `_request`(underscore=미사용) 3개 라우트는 `request` rename(타 참조 0, 안전).

## 검증 (vitest 실행)
- adminusers-ip-345b3 + orders-ip-345b2 + writeside-metadata-345b → **12 tests passed**.

## Canonical truth 보존
- AuditLog 스키마/시그니처 무변경. 가산 param. eventType/metadata 보존.

## Production effect
- 사용자 초대/승인/복구/거부 감사 레코드에 IP 기록 → 감사 페이지 "IP -" 해소(해당 액션).

## Out of Scope (다음 long-tail batch)
- ai-actions(approve/generate ~5), organizations/[id]/members, work-queue/purchase-conversion 등 나머지.
- DataAuditLog(inventory) 감사 페이지 통합 검토.

## ⚠️ 배포 주의
- 5개 파일 한 커밋(admin/users 4 + 테스트). push 전 `git status` + Vercel green.
- 함께 미푸시(이전 안내): `audit-page-mobile-311b.test.ts`(§11.337 정합+NUL 제거), `vsentinel.config.mjs` 루트 삭제.

## Rollback path
- 각 라우트 `...auditRequestMeta(request)` + `_request` rename revert. 라우트별 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
