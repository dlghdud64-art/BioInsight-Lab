# #16c — RFQ Persistence Smoke Closeout

Status: **CLOSED — PASS**
Scope: canonical sourcing → request assembly → `/api/quotes` → quotes workbench handoff
Environment: localhost:3000, Supabase test project `qbyzsrtxzlctjvbfcscs` (ap-northeast-2)
Governance: no production DB contact, no code/schema/migration/seed mutation, no `.env` edits, no dead button / no-op / fake success, canonical truth protected

---

## Decision locked

- (a) #16c RFQ persistence smoke 범위 = Quote 생성 + handoff + quotes workbench 진입.
- (b) vendor 발송 단계 smoke는 #16d로 분리. #16에서 확장하지 않음.
- (c) legacy `ComparisonModal → RequestWizardModal → /api/quotes/request` 500 경로는 #22로 parked. #16 closeout을 막지 않음.

## Why QuoteVendorRequest = 0 is expected (not a bug)

Canonical flow `POST /api/quotes` persistence surface:

| Step | Surface | Output |
| --- | --- | --- |
| createQuote() | `apps/web/src/app/api/quotes/route.ts` L165–177 | `Quote` + `QuoteListItem` |
| QuoteShare | `apps/web/src/app/api/quotes/route.ts` L184 | `QuoteShare` (공개 링크용, vendor 귀속 아님) |
| email fanout | `apps/web/src/app/api/quotes/route.ts` L239–262 | side-effect only, `QuoteVendorRequest` 생성 없음 |

`QuoteVendorRequest`가 생성되는 지점은 canonical 경로 바깥입니다:

1. `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` L132 — canonical 발송 엔드포인트 (후속 단계, #16d).
2. `apps/web/src/app/api/quotes/[id]/vendor-replies/route.ts` L159 — vendor 응답 수동 입력 경로 (보조).
3. `apps/web/src/app/api/quotes/request/route.ts` L363 — legacy RequestWizardModal이 때리던 one-shot 경로, 현재 500 상태로 #22에 parked.

따라서 canonical smoke 직후 `QuoteVendorRequest = 0`은 "아직 발송 단계를 밟지 않은 정상 상태"이지 persistence 누락이 아님.

## Evidence

Canonical UI chain PASS
- sourcing (`/test/search`) → product card select → sourcing context rail
- CompareReviewWorkWindow (canonical compare surface, not legacy ComparisonModal)
- AI strategy (`규격 신뢰 우선`) → decisionSnapshot 생성
- `견적 후보로 반영` → requestHandoff 세팅 → `request-assembly` 모드 진입
- RequestSubmissionWorkWindow 제출 → `POST /api/quotes` **201**
- `useRfqHandoffStore.setHandoff` → sessionStorage `labaxis:rfq-handoff` 기록 (1-shot, 5min TTL)
- `router.push('/dashboard/quotes?from=rfq&requestId=...')` → handoff banner 렌더 → CTA `견적 관리에서 계속` 표시 → toast 노출

Network / payload
- `POST /api/quotes` status **201**
- request handoff id: `rsub_mo9xk569`

DB state (test project only)

| Table | Count | Note |
| --- | --- | --- |
| Quote | 2 | 둘 다 `organizationId = 'org-bioinsight-lab'` ✅ |
| QuoteListItem | 3 | prior replay 1 + canonical smoke 2 = 3 ✅ |
| QuoteVendorRequest | 0 | expected — 발송 단계 미실행 |
| QuoteShare | (deferred optional read) | 필요 시 아래 스니펫으로 추가 기록 |

Supplementary evidence query (read-only, if needed):

```sql
SELECT id, "organizationId", "userId", "createdAt"
FROM "Quote"
ORDER BY "createdAt" DESC
LIMIT 1;

SELECT COUNT(*) AS quote_share_count
FROM "QuoteShare"
WHERE "quoteId" = '<latest_quote_id>';
```

## Pass/Fail contract for #16 (locked)

PASS 조건에서 제외된 항목은 명시적으로 out-of-scope:
- QuoteVendorRequest 행 수는 #16 pass 조건 아님.
- legacy `/api/quotes/request` 경로는 #16 pass 조건 아님.
- vendor 발송 endpoint 호출은 #16 pass 조건 아님.

PASS 조건에 포함된 항목 모두 충족:
- canonical UI path 통과.
- `POST /api/quotes` 201.
- `Quote` + `QuoteListItem` 행 생성.
- `/dashboard/quotes?from=rfq&requestId=...` 리다이렉트 + handoff banner + primary CTA 렌더.
- production DB mutation 0건.
- canonical truth 보호 유지 (page-per-feature 회귀 없음, chatbot/assistant 재해석 없음, dead button 없음).

## Parked follow-ups

| ID | Title | Reason parked | Next action |
| --- | --- | --- | --- |
| #16d | Vendor dispatch smoke | canonical 다음 단계, 별도 smoke로 분리 | 견적 관리 workbench에서 `/api/quotes/[id]/vendor-requests` 호출 + QuoteVendorRequest row 생성 확인 (UI 변경 없음, 기존 endpoint만) |
| #22 / #16.1 | Legacy RequestWizardModal 500 | dev server stack trace 미확보, canonical 경로 아님 | `labaxis-bug-hunter` 프로토콜 — Truth Reconciliation → Hypothesis → Validation |
| #16.2 | `/test/search` 3중 compare surface drift | `ComparisonModal` / `CompareReviewWorkWindow` / `RequestWizardModal` 병렬 존재, page-per-feature 회귀 위험 | `labaxis-delivery-planner`로 TDD 계획 승인 후 legacy surface 제거 |
| #11 | DB schema drift truth reconciliation | read-only (hero product currency `EUR` vs priceInKRW `28500` 비정합) | 별도 read-only audit |
| #19 | SF1 RFQ handoff sessionStorage lost across signin redirect | 재현 경로 확보 필요 | re-verification 시 재평가 |

## Prohibited during #16 closeout

- 추가 RFQ POST 반복 ❌
- `apps/web/prisma/seed.ts` 수정 ❌ (이미 `Gibco` 쿼리로 fixture 충분, append 불필요)
- test 데이터 cleanup ❌
- legacy `/api/quotes/request` 경로 수정 ❌ (#22 스콥)
- vendor dispatch까지 #16에서 확장 ❌ (#16d 스콥)
- production project-ref 접촉 ❌

## Closeout signoff

- smoke operator: Claude (governance: labaxis-bug-hunter B안)
- approver gate: 총괄 (권장안 (a) + (c) 승인 완료)
- canonical truth protected: YES
- release-prep P1 handoff bottleneck (소싱 → 요청 생성 → 견적 관리): UNBLOCKED
