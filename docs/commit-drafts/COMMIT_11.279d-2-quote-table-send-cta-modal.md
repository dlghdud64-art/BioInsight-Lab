# §11.279d-2 Commit Message Draft (호영님 P0)

```
fix(quotes): §11.279d-2 #quote-table-send-cta-modal-wiring — 테이블 뷰 "발송" 버튼이 openQuoteContextRail 패널 토글만 호출 → handleQuoteCardSelect 재사용 (호영님 P0)

호영님 P0 (2026-05-24):
견적 관리 테이블 뷰 "발송" 버튼 → 운영 브리핑 패널 토글만
(껐다 켜졌다 반복) → 발송 워크플로우 진입 안 됨.
§11.279 Phase 0 audit Case 2 (rail panel fallback) 확정.

Root cause (Phase 0 audit):
line 3017-3027 테이블 row actions cell button onClick 이 모든
ctaLabel (발송 포함) 에 대해 openQuoteContextRail 직접 호출.
§11.279d 카드 [발송] CTA 의 handleQuoteCardSelect 분기 ("견적
요청 발송" → setActiveWorkWindow("request_send")) 를 거치지 않음.
카드 [발송] CTA (line 779) 는 정상 wiring — 테이블만 누락.

Fix (1 file ~10 line + 1 NEW test, minimum-diff):
- apps/web/src/app/dashboard/quotes/page.tsx line 3017-3027:
  · onClick 변경: openQuoteContextRail(quote.id, "row")
                  → handleQuoteCardSelect(quote.id, signals.ctaLabel)
  · data-testid="quote-table-direct-send-cta" (발송 시만)
  · §11.279d-2 trace marker comment
  · e.stopPropagation 보존 (행 클릭 vs 버튼 클릭 분리)

회귀 0:
- handleQuoteCardSelect 자체 변경 0 (재사용)
- "견적 요청 발송" → setActiveWorkWindow("request_send") (§11.279d)
- 다른 CTA → openQuoteContextRail 분기 그대로
- §11.279d 카드 [발송] CTA wiring 보존 (line 779)
- §11.293 공급사 발송 toggle reset fix 보존
- e.stopPropagation 보존

호영님 production effect:
1. 테이블 "발송" click → VendorRequestModal 진입 (패널 토글 0)
2. 다른 CTA click → openQuoteContextRail
3. 행 자체 click → openQuoteContextRail (button 과 분리)
4. 발송 모달 공급사 선택 해제 정상 (§11.293)

Lessons:
1. 카드/테이블 일관성 — 같은 user intent 같은 handler
2. §11.279d audit Case 2 가 테이블에 잔존 — 다른 surface audit
3. minimum-diff — 1 file 10 line + 1 NEW test
```

## Push

```bash
git add apps/web/src/app/dashboard/quotes/page.tsx \
        apps/web/src/__tests__/regression/quote-table-send-cta-279d2.test.ts \
        docs/commit-drafts/COMMIT_11.279d-2-quote-table-send-cta-modal.md

git commit -F docs/commit-drafts/COMMIT_11.279d-2-quote-table-send-cta-modal.md
git push origin main
```

## Production smoke (데스크탑 테이블)

1. labaxis.co.kr/dashboard/quotes Cmd+Shift+R
2. 테이블 뷰 선택
3. "요청 발송 전" row "발송" click → **VendorRequestModal 진입** ✅
4. 모달 공급사 7개 toggle (§11.293) 정상
5. 다른 CTA (새 회신 보기) → 패널 열기 (기존 동작)
6. 행 자체 click → 패널 열기 (button click 과 분리)
