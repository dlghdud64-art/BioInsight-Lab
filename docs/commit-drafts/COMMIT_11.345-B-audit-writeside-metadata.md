# COMMIT — §11.345-B 감사 추적 write단 보강 (IP/UA + PDF 재분류)

```
fix(audit) §11.345-B #audit-writeside-metadata — IP/UA 헬퍼 + quote_pdf DATA_EXPORTED 재분류 + 고가치 라우트 IP 보강 (호영님 P2)
```

## 호영님 spec (§11.345 Part B, write단)
- 감사 추적 "IP -"·일부 "변경 내역 -" 의 원인 = write단 미수집. Part 11 정합 보강.
- 결정: 고가치 subset 먼저 + quote PDF 재분류는 DATA_EXPORTED 재사용(마이그레이션 0).

## 진단 핵심
- 감사 페이지 소스 = `AuditLog`(`lib/audit/audit-logger.ts` object-form). 별개로 `DataAuditLog`(`lib/audit.ts`)는 페이지 비노출.
- value-change 라우트(security/approval-policy/workspaces)는 이미 `changes:{before,after}` 보유 — **공통 결손은 IP**. org/sso 는 이미 IP 보유.
- `quote_pdf_generate`가 `SETTINGS_CHANGED`로 오분류(설정 변경 아님).

## Fix (file 별)
- `lib/audit/audit-logger.ts`: `auditRequestMeta(request)` 헬퍼 추가(x-forwarded-for 첫 IP / x-real-ip / user-agent). request 없는 시스템·cron 호출은 미사용 → IP "기록 없음"(정상).
- `app/api/quotes/[id]/generate-pdf/route.ts`: `SETTINGS_CHANGED → DATA_EXPORTED` 재분류 + `...auditRequestMeta(request)`. export 라 changes 없음이 정상.
- `app/api/organizations/[id]/security/route.ts`: `...auditRequestMeta(request)` (changes 기보유).
- `app/api/admin/users/[id]/approval-policy/route.ts`: `...auditRequestMeta(request)` (changes 기보유).
- `app/api/workspaces/[id]/route.ts`: `...auditRequestMeta(request)` (threshold changes 기보유).
- `__tests__/regression/audit-writeside-metadata-345b.test.ts`: sentinel.

## Canonical truth 보존
- `AuditLog` 스키마 무변경(ipAddress/changes 필드 기존재). createAuditLog 시그니처 호환(가산 param). 마이그레이션 0.

## Production effect
- security/approval-policy/workspaces/quote-PDF 감사 레코드에 IP 기록 → 페이지 "IP -" 해소(해당 액션).
- quote PDF 가 "데이터 내보내기"로 정확히 분류, "변경 내역" 비움이 의미상 정상.

## Out of Scope (다음 배치)
- 나머지 long-tail 라우트(ai-actions generate, orders, invite 등) IP 보강 — 대부분 create/generate 라 before/after N/A. 점진 적용.
- `DataAuditLog`(inventory 등) 페이지 노출 통합 여부 — 별도 검토.
- DB 레벨 tamper-proof(트리거/RLS).

## Rollback path
- 각 라우트 `...auditRequestMeta(request)` 라인 + 헬퍼 + eventType 한 줄 revert. 라우트별 독립.

## ⚠️ 배포 주의
- 6개 파일 한 커밋(audit-logger / generate-pdf / security / approval-policy / workspaces / 테스트). push 전 `git status`로 전부 staged 확인 + Vercel green.

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 검증 완료. 배포 후 설정/결재한도 변경 시 감사 페이지에 IP 노출 + quote PDF "데이터 내보내기" 표기 Chrome 확인 예정.
```
footer 없음 (Co-Authored-By 미사용)
```
