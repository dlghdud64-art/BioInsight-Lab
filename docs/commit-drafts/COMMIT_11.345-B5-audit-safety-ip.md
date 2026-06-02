# COMMIT — §11.345-B5 safety 라우트 write단 IP 보강 (long-tail 최종)

```
fix(audit) §11.345-B5 #audit-writeside-safety-ip — safety 조회/매핑 라우트 IP·UA 캡처 (write단 IP 보강 완결, 호영님 P2)
```

## 호영님 spec (§11.345 Part B long-tail 마지막)
- 안전/지출 조회·수동 매핑 감사 이벤트의 IP 기록. long-tail IP 보강 완결.

## Fix (file 별)
- `app/api/safety-spend/route.ts` (GET view_summary): 동적 import 에 `auditRequestMeta` 추가 + `...auditRequestMeta(request)`.
- `app/api/safety/spend/map/route.ts` (POST purchase_manual_map): 동일 (changes 기보유).
- `app/api/safety/spend/summary/route.ts` (GET safety_spend_view): 동일.
- `__tests__/regression/audit-writeside-safety-ip-345b5.test.ts`: sentinel.

## 검증 (vitest 실행 — audit 전체 묶음)
- safety-B5 + membership-B4 + adminusers-B3 + orders-B2 + writeside-B + event-classification-337 + page-mobile-311b → **7 files, 52 tests passed**.

## write단 IP 보강 현황 (완결)
- 보강 완료: security/approval-policy/workspaces/quote-pdf(B) · orders(B2) · admin/users(B3) · membership/PR(B4) · safety(B5).
- 기보유(작업 불필요): ai-actions ×6, quotes/[id], org/sso.
- 시스템/cron(request 없음, IP=기록 없음 정상): convert-pocandidate-to-orders, operational-brief-injection-audit, cron.
- → AuditLog write단 IP 미보유 라우트 **0건**.

## Canonical truth 보존
- AuditLog 스키마/시그니처 무변경. 가산 param. eventType/changes/metadata 보존.

## Out of Scope (남은 결정 건)
- `DataAuditLog`(inventory 등)을 감사 페이지에 통합할지 — 코드 추가가 아니라 "어느 모델을 노출할까" 제품 결정.
- safety GET 조회 이벤트의 분류(현재 SETTINGS_CHANGED) — §11.337 표시 매핑으로 "조회·출력" 분류 추가 검토 가능(선택).

## ⚠️ 배포 주의
- 4개 파일 한 커밋. push 전 `git status` + Vercel green.
- 누적 미푸시: `audit-page-mobile-311b.test.ts`(§11.337+NUL), `vsentinel.config.mjs` 루트 삭제.

## Rollback path
- 각 라우트 동적 import `auditRequestMeta` + `...auditRequestMeta(request)` revert. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
