docs(inventory): §11.322 Phase 5 #closeout — 모바일 + 회귀 audit + plan 종결 (sandbox 작업 0, PLAN closeout only) (호영님 P1, 2026-05-30)

호영님 P1 §11.322 Phase 5 (GREEN, closeout) — 모바일 final + 회귀 audit + plan 종결.

배경:
- §11.322 Phase 2~4 작업으로 sentinel 모든 단언 자연 GREEN
- §11.320 Phase 5 패턴(액션 button min-h-[44px] + 접기 button min-h-[32px])이 §11.322 Phase 2~4 작업 위에 자연 보존
- sourcing-context-rail 회귀 = §11.320 Phase 5 audit 결과 의존 0 확인됨, §11.322 작업이 영향 0
- 추가 sandbox 작업 0 — PLAN closeout + commit draft 만

Fix (Phase 5 — PLAN 문서 closeout only):

- docs/plans/PLAN_11.322-inventory-context-panel-2nd-refinement.md:
  · Status: ⏳ Pending → ✅ Complete (Phase 0~5 sandbox 완료, 호영님 push 대기)
  · Phase 0~5 모든 체크박스 [x]
  · Last Updated: 2026-05-30 (Phase 5 closeout)
  · Notes & Learnings 갱신:
    · Blockers Encountered (§11.320 sentinel 동시 swap / toneAction 중복 / Phase 5 자연 보존)
    · Phase별 commit/draft 5건 추적
    · Production effect 5 phase 합산 (A~E + 모바일 first fold)
    · §11.320 → §11.322 cross-reference (최단 LOT 결정 번복 / 모바일 패턴 보존 / KPI sentinel 갱신 / 접힘 패턴 통일)

§11.322 Phase 1 sentinel 모든 단언 자연 GREEN (Phase 2~4 작업 결과):
- A: 인라인 row 4 testid (current/safety-stock/expiring-soon/shortest-lot) ✓
- A: grid-cols-3 + MetricCell 패턴 잔존 0 + flex justify-between ✓
- B: qtyTone 보존 + text-red-600 분기 ✓
- C: toneSub "현재 ${qty}" 패턴 0 + "즉시 재주문 필요" / "우선 소진 권장" 매칭 ✓
- D: visibleRisks / risks.filter / filteredRisks 표현 + length 0 시 섹션 생략 ✓
- E: isActionsSectionExpanded / setIsActionsSectionExpanded + aria-expanded ✓
- canonical: InventoryContextPanel props 보존 / §11.320 결정 (탭/상태 배너/액션 상단/접기 3) / 권장 액션 섹션 자체 / 폐기 분리 ✓
- Phase 5: 액션 button min-h-[44px] 4건(§11.320 Phase 5 보존) ✓
- Phase 5: sourcing-context-rail SEVERITY_STYLE / SectionHeader 미공유 grep 0 ✓

회귀 audit 결과 (sandbox grep):
- §11.320 sentinel KPI 단언 = Phase 2 동시 swap 완료 ✓
- §11.317-b ai-pipeline @ts-nocheck batch = 본 plan scope 영향 0 ✓ (별도 file)
- §11.319 시약 라벨 스캔 (Opus 4.8 별도 채팅) = 별도 surface ✓
- §11.312-b 소싱 sticky bar 보강 (backlog) = 별개 file ✓
- caller 2곳 (inventory-content:2725 / inventory-main:1958) props 변경 0 ✓
- MetricCell 외부 14 file 사용처 = 본 패널만 미사용 전환, 영향 0 ✓
- operational-brief-* 4 file = caller-side 영향 0 ✓

§11.322 전체 5 phase 합산 production effect:
- A: KPI grid-cols-3 카드 → 인라인 row 4 (현재/안전재고/만료 임박/최단 LOT) — "0 bottle" 잘림 0
- B: 위험 카드 빨간 테두리 사라짐 — text-red-600 텍스트 색상만 (§11.302 정합)
- C: 상태 배너 정량 숫자 제거 — 결론 only, 재고 현황이 유일한 숫자 출처
- D: 안전재고 미달 = 상태 배너 흡수, expiring 만 잔존, 부가 리스크 없으면 섹션 생략
- E: 정보 위계 3 단계 통일 — 권장 액션 접힘 추가 (3차 4 섹션 모두 접힘)
- 모바일 first fold = 상태 배너 + 액션 button + 재고 현황 인라인 row 4 도달

호영님 production effect (Phase 5 단독):
- production 변화 0 (문서만)
- §11.322 batch 5 phase 종결 명시 — release-prep cleanup 의 마지막 inventory-context-panel 작업

Out of Scope:
- 다음 트랙 (§11.325 제품 상세 진입 동선 Truth Reconciliation = 신규 batch, §11.312-b 소싱 sticky bar 보강 = backlog, §11.324 랜딩 Triage 데모 정리 = backlog)

검증:
- PLAN file Status Complete ✓
- Phase 0~5 체크박스 [x] ✓
- Notes & Learnings 갱신 ✓
- sandbox commit 0 (호영님 push 의존, 통제 구조 준수)

Rollback path: git revert <SHA>
- PLAN 문서만 변경 (Status / 체크박스 / Notes) revert

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.322-inventory-context-panel-2nd-refinement.md `
  docs/commit-drafts/COMMIT_11.322-phase5-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.322-phase5-closeout.md
git push origin main
```

## Production smoke
- N/A (PLAN closeout only, production 변화 0)
- 호영님 §11.322 Phase 2~4 production smoke 누적 결과 = 5 phase 합산 효과 확인 완료 가정

## Next (호영님 push 회신 후)

§11.322 완전 종결. 다음 트랙 (호영님 결정):
- §11.325 제품 상세 진입 동선 Truth Reconciliation (P1, sandbox audit type, 1~2h)
- §11.312-b 소싱 sticky bar 보강 (backlog, P1)
- §11.324 랜딩 /search Triage 데모 정리 (backlog, P2)
