# COMMIT — §11.348-A-4b: 입고안 리뷰 UI + list API + CSRF exempt

```
feat(receiving) §11.348-A-4b #receiving-review-ui — 공급사 입고 회신 검토 패널(승인/반려) + list API + 회신 POST CSRF exempt 등록 (same-canvas)
```

## 무엇 (폐루프 실사용 완성)
- A-4 승인/반려 backend를 **연구소가 실제로 누를 화면**으로 연결:
  1. `GET /api/receiving-drafts?status=PENDING_REVIEW` — 조직/본인 스코프 입고안 목록(조회만).
  2. `<ReceivingReviewPanel>` — 회신 도착분을 카드로 표시(발주번호·공급사·품목 LOT·실수량·유효기간) + 승인·입고 / 반려 버튼(csrfFetch → A-4 라우트). 0건 시 자동 숨김.
  3. `dashboard/receiving` 랜딩 **상단에 same-canvas 마운트** (신규 페이지 X — page-per-feature 금지 준수, ops-store 무수정).

## CSRF 갭 수정 (A-2 후속 — 중요)
- A-2 의 공급사 회신 POST `/api/receiving/[token]/response` 가 CSRF registry 에 미등록 → 기본 `required` → **공급사(세션·토큰 없음)가 회신 시 차단되는 잠재 결함**.
- `csrf-route-registry.ts` exempt 에 `public_token_auth` 로 등록(견적 `/api/vendor-requests/[token]/response` 와 동형).
- `csrf-batch10.test.ts` 정합: exempt 8→9, public_token_auth 1→2, it.each 목록 추가. → **58/58 green**(authoritative gate).

## 신규/수정 파일
- 신규: `api/receiving-drafts/route.ts`(GET list), `components/receiving/receiving-review-panel.tsx`.
- 수정: `dashboard/receiving/page.tsx`(import + `<ReceivingReviewPanel />` 마운트), `lib/security/csrf-route-registry.ts`(exempt +1), `lib/security/__tests__/csrf-batch10.test.ts`(count 정합).

## canonical / 제약 준수
- 패널·list API 는 조회/트리거만 — canonical mutation 은 A-4 서버 라우트(트랜잭션·다중 가드)에서만.
- same-canvas(기존 receiving 랜딩 통합), ops-store(`unifiedInboxItems`) 무수정 → 회귀 리스크 격리.
- 0건 시 패널 미표시(공간 절약, §11.311 first-fold 정신).

## migration
- **없음.**

## 검증 (vitest)
- `receiving-review-panel-348a4b.test.ts` → **5/5** (파일 / list 스코프 / 패널 csrfFetch / same-canvas 마운트 / CSRF exempt).
- `csrf-batch10.test.ts` → **58/58** (exempt 9 정합).

## Out of Scope / 알려진 사항
- 회신 도착 **알림**(연구소 push/메일) — 후속.
- `csrf-batch10-node.mjs`(수동 보조 harness)는 **미포함**: HEAD 가 CRLF(.gitattributes eol=lf 위반) + highRisk 단언 2건이 **이미 pre-existing drift**(A-4b 무관, HEAD 에서도 동일 실패). 별도 위생 트랙. 권위 게이트는 vitest `.test.ts`.
- A-5 현장 QR/스캔 접합.

## Rollback
- 신규 2파일 삭제 + page/registry/test 패치 revert. ops-store 무수정이라 독립.
```
footer 없음
```
