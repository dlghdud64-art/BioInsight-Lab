# COMMIT — §11.364 Phase 1 (D-1+D-2): 운영 바로가기 액션존↔네비존 분리 + 데코 컬러 제거

```
refactor(dashboard) §11.364 D-1+D-2 #quick-actions-nav — 운영 바로가기를 순수 네비로 강등(견적 발송 카드 expand/CTA 폐기, 발송 동선 보존) + 좌측 컬러바·TONE_MAP 제거(아이콘 무채색·배지 §11.302 노랑)
```

## 무엇 (§11.364 D-1·D-2 — 호영님 P1, 2026-06-04)
- **D-1**: 상단 액션존(처리 CTA)과 하단 "운영 바로가기"가 둘 다 건수+처리버튼 → 같은 일을 두 군데서 답하는 중복. 특히 견적 발송 카드만 expand 패널 + 파란 in-card CTA를 가져 "처리 액션 카드"처럼 보임.
- **D-2**: 카드 좌측 컬러바(`border-l-2 tone.accent`)·4색 아이콘 박스 = 상태 아닌 데코 → 생성형/AI 템플릿 톤.

## Phase 0 가드레일 (방법 A 승인)
- 상단 priority 후보(§11.362-1/2 = 만료/SLA/재고/입고/응답도착)에 "견적 발송 대기" **미커버**(respondedQuotes=응답 도착 ≠ 발송 대기).
- → quotes 카드를 **제거가 아닌 균질 네비 카드로 강등**: 클릭 시 발송 워크벤치 라우팅(진입 동선 보존). 상단 추가 불필요(발송 대기=네비 큐).

## Fix (`operator-quick-actions.tsx` 재작성)
- **D-1**: quotes 특수 분기(`if countKey==="quotes"`, expand state, summary, in-card CTA, 접기) 제거 → 4 카드 균질 `Link`. `ACTIONS[0]` = label "견적 발송" + href `/dashboard/quotes?labaxisPilot=quote-dispatch`(발송 동선 보존). useState/`<button>`/mutation 0 → 순수 네비. count display-only 유지.
- **D-2**: 좌측 `border-l-2` 컬러바 제거, `TONE_MAP` 데코 팔레트 삭제, 아이콘 박스 무채색(`bg-slate-100`/`text-slate-600`), 건수 배지 = §11.302 노랑(`bg-yellow-100 text-yellow-700`, 검토 대기), 0건 무표기(ChevronRight).

## canonical truth
- 카드 = count display-only(mutation 0). 발송 truth = 견적 워크벤치 소유. 데이터 변경 0, 역할/시각만.

## 검증
- sentinel: 신규 `dashboard-quick-actions-nav-364`(D-1+D-2). 갱신(강등 supersede): `operator-quick-actions-responsive`(§11.247 expand 폐기), `dashboard-quote-dispatch-card-evidence`(§11.308d-2 dispatch-card 폐기, 발송 href 보존), `operator-quick-actions-amber-removed-308d`(TONE_MAP 제거 정합), `operator-quick-actions-252a`(expand→강등).
- sandbox grep 정합: 보존 패턴(grid/min-h/badge/counts/href) 전부 매칭, 부재 단언(expand/aria-expanded/TONE_MAP/border-l-2/dispatch-card) 전부 0. ⚠️ vitest = Claude Code `npm run test`.
- 배포 후 Chrome: 바로가기 카드 = 단순 진입(처리버튼 0), 컬러바 0, 발송 카드 클릭 → 워크벤치 진입.

## Out of Scope
- §11.364 D-3(밀도)·D-6(FAB/랜딩) = 후속 phase. D-7(지출 IA)·§0(AI 정책) = 별도 batch.

## Rollback
- operator-quick-actions.tsx 단일 파일 revert + sentinel 4종 원복.
```
footer 없음
```
