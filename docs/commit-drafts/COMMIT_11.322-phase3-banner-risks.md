refactor(inventory): §11.322 Phase 3 #banner-risks — 상태 배너 결론 only + 리스크 섹션 below_safety 흡수 (호영님 P1, 2026-05-30)

호영님 P1 §11.322 Phase 3 (GREEN) — C. 상태 배너 정량 숫자 제거 + D. 리스크 필터링.

배경:
- §11.320 production smoke 후 호영님 잔여 문제 C/D:
  · C. 상태 배너 ↔ 재고 현황 정보 중복 ("현재 0 / 안전재고 8" 두 번)
  · D. 리스크 "안전재고 미만" ↔ 상태 배너 중복 (같은 정보 다른 위치)
- 호영님 spec 5/6 정합: 상태 배너 = 결론+액션만, 재고 현황 섹션이 유일한 숫자 출처, below_safety 리스크는 상태 배너로 흡수
- generateMockRisks(line 128-197) 의 risk.type 식별자 활용: "expiring" / "below_safety"

Fix (Phase 3 — inventory-context-panel.tsx 단일):

- C. 상태 배너 toneSub 결론 only (line 527-538):
  · 옛 toneSub: `현재 ${item.currentQuantity} ${item.unit} / 안전재고 ${item.safetyStock ?? "-"} ${item.unit}` (정량 숫자 포함)
  · 신 toneSub: 결론 문구 only
    · danger + isOutOfStock → "즉시 재주문 필요"
    · danger + !isOutOfStock → "안전재고 보충 권장"
    · warn → "만료 임박 — 우선 소진 권장"
    · ok → "정상 운영 중"
  · toneAction 변수(line 533-534) + display(line 555 "→ {toneAction}") 함께 제거 (의미 중복, 결론은 toneSub 한 줄로 통합)
  · 상태 배너 JSX 구조 단순화: toneLabel + toneSub(font-semibold) — 액션 button 이 결론 액션 wiring 책임

- D. 리스크 섹션 visibleRisks 필터링:
  · `const visibleRisks = risks.filter((r) => r.type !== "below_safety");` 신설 (line 412, risks 직후)
  · risks.length > 0 / count / map 3곳 (line 838/841/843) → visibleRisks 로 swap
  · length 0 시 섹션 자체 생략 (조건부 render 보존)
  · inventorySummary narrative 입력(line 434-435 `${risks.length}건 운영 리스크`) = 전체 risks 그대로 유지 (흡수 여부와 무관, 운영 브리핑 hook 입력)
  · expiring 타입 리스크(만료 임박/만료 주의/유효기간 만료)는 리스크 섹션에 유지 — 호영님 spec D "부가 리스크" 정합

canonical 보존 (회귀 0):
- toneClass / toneIcon / toneLabel 보존 (§11.302 신호등 + 분기 라벨)
- 상태 배너 wiring(operationalBriefPopup.open / onClick / keyDown) 보존
- 액션 button 4종 (재주문/우선 소진/입고 등록/정보 수정) wiring 보존 — Phase 2 min-h-[44px] 포함
- generateMockRisks 함수 자체 변경 0 (전체 risks 데이터 보존)
- inventorySummary narrative hook 입력 = risks.length (보존, brief-narrative 영향 0)
- isExpiredLotWithQty / disposal-strip 보존

§11.322 Phase 1 sentinel GREEN 전환 (C + D):
- C: toneSub 옛 `현재 ${item.currentQuantity}` 패턴 잔존 0 ✓
- C: "즉시 재주문 필요" 또는 "우선 소진 권장" 매칭 ✓
- D: visibleRisks 변수 매칭 ✓
- D: visibleRisks.length > 0 매칭 ✓

여전히 RED (Phase 4 GREEN target):
- E: 권장 액션 useState 접기 (Phase 4)

호영님 production effect:
1. 상태 배너 정량 숫자 사라짐 — "현재 0 / 안전재고 8" → "즉시 재주문 필요" 결론 only.
2. 재고 현황 인라인 row 4(Phase 2) = 유일한 숫자 출처 (호영님 spec "단일 정보 출처" 정합).
3. 리스크 섹션 안전재고 미달/재고 소진 사라짐 — 상태 배너 흡수.
4. 안전재고 미달만 있는 case: 리스크 섹션 자체 생략(visibleRisks.length 0) → above the fold 공간 회수.
5. 만료 임박/만료 주의 등 expiring 리스크는 유지 — 호영님 spec "부가 리스크" 정합.

Out of Scope (Phase 4~5):
- E: 권장 액션 접힘 (Phase 4)
- 모바일 final + 회귀 통합 (Phase 5)
- "권장 발주 30 ea" 같은 backend 수량 데이터 의존 표시 (별도 batch, backend 작업 필요)

검증 (sandbox 정적 grep):
- toneSub 옛 "현재 ${item.currentQuantity}" 패턴 잔존 0
- toneSub 신 결론 문구 4가지 매칭 ("즉시 재주문 필요" / "안전재고 보충 권장" / "만료 임박 — 우선 소진 권장" / "정상 운영 중")
- toneAction 변수/display 잔존 0
- visibleRisks 변수 4건 (선언 + length + count + map)
- inventorySummary `risks.length` 보존 (전체 narrative 입력)

Rollback path: git revert <SHA>
- 옛 toneSub 정량 패턴 + toneAction 변수/display 복원
- visibleRisks 변수 제거, 3곳 risks 복원

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/inventory-context-panel.tsx `
  docs/commit-drafts/COMMIT_11.322-phase3-banner-risks.md
git status
git commit -F docs/commit-drafts/COMMIT_11.322-phase3-banner-risks.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 품목 click → 우측 패널 open
3. 상태 배너 — 결론 only 표시:
   · 위험: "🔴 재고 소진 / 즉시 재주문 필요" (정량 숫자 0)
   · 안전재고 미달: "🔴 안전재고 미달 / 안전재고 보충 권장"
   · 만료 임박: "🟡 만료 임박 / 만료 임박 — 우선 소진 권장"
   · 정상: "✅ 정상 / 정상 운영 중"
4. 액션 button 4종 (재주문/우선 소진/입고 등록/정보 수정) 정상 동작
5. 리스크 섹션 — visibleRisks 분기:
   · 안전재고 미달만 있을 때: 섹션 자체 생략 (length 0)
   · 만료 임박/만료 주의/유효기간 만료: 리스크 섹션 유지
   · expiring + below_safety 동시: expiring 만 남음
6. 재고 현황 인라인 row 4 — 유일한 숫자 출처 (Phase 2)
7. 운영 브리핑 popup (상태 배너 click) — narrative `${risks.length}건 운영 리스크` 보존

## Next (호영님 push 회신 후)
- Phase 4: E (권장 액션 useState 접힘) + 모바일 final
