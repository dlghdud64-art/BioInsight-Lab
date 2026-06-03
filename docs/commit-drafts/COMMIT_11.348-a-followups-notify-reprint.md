# COMMIT — §11.348-A 후속: 회신 도착 알림 + 라벨 재출력

```
feat(receiving) §11.348-A-followups #notify-reprint — 입고 회신 도착 시 연구소 알림(VENDOR_REPLIED dispatch+push) + 승인 후 라벨 재출력 어포던스
```

## 무엇 (폐루프 운영 편의 — 소형 2종, migration 0)
1. **회신 도착 알림 (§11.348-A-2-notify)**: 공급사 회신 제출(`PENDING_REVIEW`) 시 연구소가 즉시 인지하도록 알림. 없으면 회신 와도 모름 = 폐루프 단절.
2. **라벨 재출력 (§11.348-A-5b)**: 승인 직후 라벨 모달을 닫았어도 방금 확정분을 다시 출력.

## Fix (file별)
- `api/receiving/[token]/response/route.ts`:
  - 트랜잭션(PENDING_REVIEW) 후 알림 블록 — 수신자 = draft.userId + 조직 OWNER/ADMIN(`organizationMember.findMany`).
  - `dispatchNotificationEvent({ eventType: "VENDOR_REPLIED", entityType: "ORDER", entityId: orderId, recipients, metadata })` + 수신자별 `sendPushNotification`(title "입고 회신 도착").
  - **전체 try/catch graceful** — 알림 실패가 vendor 제출(이미 커밋)을 막지 않음. 재고 mutation 0 유지(불변 sentinel).
- `components/receiving/receiving-review-panel.tsx`:
  - `labelItems.length > 0 && !labelOpen` 시 "방금 승인한 입고 라벨 재출력" 버튼 → 모달 재오픈. 신규 API/뷰 0.

## 설계 결정
- **VENDOR_REPLIED 재사용**: 신규 NotificationEventType 추가는 event-types-semantic-drift sentinel + "정규 N종" 제약 건드림 → 의미 근접한 기존 타입("공급사 응답 도착") 재사용으로 registry churn 0. entityType=ORDER 전달(dispatcher 는 mismatch 시 console warn만, 비차단).
- 라벨 재출력은 in-session(이미 패널 state 의 labelItems) 재오픈 — APPROVED 목록 뷰(별도 트랙)는 미도입(과욕 방지).

## migration
- **없음.**

## 검증 (vitest)
- `receiving-followups-348a-notify-reprint.test.ts` → **3/3**.
- 회귀: A-2 5/5, A-4b 5/5, A-5 3/3 (총 16/16).

## Out of Scope (별도 세션)
- §11.348-B-1 파일 인프라(SDSDocument migration + Supabase signed-url + MSDS/COA 뷰어 + 안전 mock 해소) — Large/migration, `PLAN_11.348-B1` 별도.
- §11.348-FALLBACK(OCR 외부문서 정규화) — Large.
- APPROVED 입고안 영구 재출력 뷰 — receiving 워크벤치 확장 시.

## Rollback
- response 라우트 알림 블록 + 패널 재출력 버튼 + sentinel revert. graceful 라 독립.
```
footer 없음
```
