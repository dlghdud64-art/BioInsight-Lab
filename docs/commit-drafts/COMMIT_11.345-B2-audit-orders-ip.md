# COMMIT — §11.345-B2 발주 라우트 write단 IP 보강 (long-tail batch 1)

```
fix(audit) §11.345-B2 #audit-writeside-orders-ip — 발주 update/send-email/PDF 라우트 IP·UA 캡처 (호영님 P2)
```

## 호영님 spec (§11.345 Part B long-tail)
- 감사 추적 "IP -" 잔여 해소. 고가치 subset(§11.345-B) 후속으로 사용자 트리거 발주 라우트부터 점진 보강.
- 작고 안전한 배치 우선(가산 변경, before/after는 기존 보존).

## Fix (file 별)
- `app/api/orders/[id]/route.ts` (PATCH order_update): `...auditRequestMeta(request)` (changes 기보유).
- `app/api/orders/[id]/send-email/route.ts` (POST vendor_email_sent): POST 시그니처 `_request`→`request` + `...auditRequestMeta(request)`.
- `app/api/orders/[id]/generate-pdf/route.ts` (POST pdf_generate, PO_PDF_GENERATED): `_request`→`request` + `...auditRequestMeta(request)`.
- `__tests__/regression/audit-writeside-orders-ip-345b2.test.ts`: sentinel (3 route IP 캡처 + _request 제거 + PO_PDF_GENERATED 보존).

## 진단 메모
- `quotes/[id]/route.ts`는 이미 ipAddress/userAgent 캡처 중 → 대상 제외.
- `_request`(underscore=미사용)였던 2개 라우트는 IP 캡처 위해 `request`로 rename(타 참조 0, 안전).

## 검증 (vitest 실행)
- `audit-writeside-orders-ip-345b2` + `audit-writeside-metadata-345b` → **8 tests passed**. (root hoist vitest + Linux rollup 보강 + 최소 config)

## Canonical truth 보존
- AuditLog 스키마/시그니처 무변경. 가산 param만. before/after·eventType 보존.

## Production effect
- 발주 수정/이메일 발송/PDF 생성 감사 레코드에 IP 기록 → 감사 페이지 "IP -" 해소(해당 액션).

## Out of Scope (다음 long-tail batch)
- ai-actions(approve/generate), admin/users(route/approval/restore/invite/members), organizations/members, work-queue 등 나머지 라우트 IP.
- DataAuditLog(inventory 등) 감사 페이지 통합 검토.

## ⚠️ 배포 주의
- 4개 파일 한 커밋(orders 3 + 테스트). push 전 `git status` + Vercel green.
- 함께 미푸시 상태: 갱신된 `audit-page-mobile-311b.test.ts`(§11.337 export 정합 + NUL 제거) → §11.337 커밋과 같이 푸시 필요.

## Rollback path
- 각 라우트 `...auditRequestMeta(request)` 라인 + `_request` rename revert. 라우트별 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
