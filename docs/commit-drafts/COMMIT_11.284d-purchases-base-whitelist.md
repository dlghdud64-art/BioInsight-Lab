# §11.284d Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(purchases): §11.284d 구매 운영 base status whitelist filter + empty state spec 정합 (호영님 P1 Phase 1 잔여 #2, 발주 단계만 표시)

호영님 P1 Phase 1 잔여 5 항목 재요청 audit 결과:
- #3 카드 본문 (안녕하세요 견적 요청 메시지 제거): §11.284c 이미 land
  (line 770-798 금액/공급사 1줄 표시)
- #4 "견적 상세 →" 버튼: §11.277b "다음 단계로 이동" 이미 swap
- #6 영문 잔여 (OPERATIONAL BRIEFING / PO 전환 / Send to supplier 등):
  grep 0건, 이미 한글화
- #2 status filter (이 fix): 진짜 미반영 — base filter 0, queueTab="all"
  시 모든 status (견적 단계 포함) 표시

호영님 보고 vs 실제 코드 mismatch 원인: production stale browser cache.
실제 미반영은 #2 1건만.

Fix (1 file ~25 line + 1 NEW test):
- apps/web/src/app/dashboard/purchases/page.tsx:
  · PURCHASE_STAGE_STATUSES useMemo NEW (Set, Object.keys(STATUS_MAP) —
    review_required / ready_for_po / hold / confirmed / expired 5종)
  · filteredItems base filter — items.filter(i =>
    PURCHASE_STAGE_STATUSES.has(i.conversionStatus))
  · 견적 단계 (sent / collecting / comparing) conversionStatus 자동 제외
  · empty state 메시지 swap — "발주 전환 대기 중인 건이 없습니다" +
    "견적 비교가 완료되면 여기에 표시됩니다. 견적 관리에서 회신을 비교한
    뒤 '발주 전환'을 누르면 구매 운영 큐로 이동합니다"

- apps/web/src/__tests__/regression/purchases-base-whitelist-284d.test.ts
  (NEW, 6 it):
  · §11.284d trace + PURCHASE_STAGE_STATUSES 정의 + Object.keys(STATUS_MAP)
  · .has(conversionStatus) base filter
  · empty state 2 메시지 (호영님 spec 정확 채택)
  · queueTab + searchQuery 보존 (회귀 0)

canonical truth 보존:
- queueTab + searchQuery filter 보존
- STATUS_MAP 5종 + KpiCard / queue tab 분기 변경 0
- §11.284c 카드 본문 (금액/공급사) 보존
- §11.277b 다음 단계 onClick 보존
- §11.273b 모바일 1줄 요약 바 보존
- API contract 변경 0 (frontend filter 만)

Verification (sandbox grep simulation):
- §11.284d ×2 / PURCHASE_STAGE_STATUSES ×3 / .has ×1
- empty state 메시지 2종 ×1 each

호영님 production effect:
1. 구매 운영 목록에 견적 단계 item 자동 제외 → 발주 5 status 만 표시
2. 견적 비교 안 끝난 건은 견적 관리에서만 보임 → 두 surface 정체성 분리
3. empty state "발주 전환 대기 중인 건이 없습니다" + 다음 액션 안내
4. 호영님 "구매 운영 = 견적 관리 복제본" 인지 → "발주 관리 화면" 인지 전환

Out of Scope (Phase 2):
- 발주서(PO) PDF 발행 + 자동 채번
- 결재 라인 자동 설정
- 공급사 통보 자동 이메일
- 그룹웨어 연동 (더존/다우오피스/영림원)

#3/#4/#6 별도 작업 (이미 land, 호영님 production hard refresh 권장)

Rollback path: git revert <SHA>
- 1 file ~25 line revert + 1 test 삭제 → base filter 제거 회귀

Lessons:
1. 호영님 보고 vs 실제 코드 audit 항상 먼저 — Phase 1 잔여 4 중 3 이미 land,
   실제 미반영 1건만 정확 식별 (minimum-diff)
2. STATUS_MAP key = whitelist source (드라이 — 새 status 추가 시 자동 포함)
3. empty state 부카피 = surface 정체성 강화 도구
4. frontend filter (API contract 변경 0) vs backend filter (별도 batch)
```

## Files to stage

```
apps/web/src/app/dashboard/purchases/page.tsx
apps/web/src/__tests__/regression/purchases-base-whitelist-284d.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.284d-purchases-base-whitelist.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

# sentinel test 검증 (선택)
pnpm vitest run apps/web/src/__tests__/regression/purchases-base-whitelist-284d.test.ts

git add apps/web/src/app/dashboard/purchases/page.tsx \
        apps/web/src/__tests__/regression/purchases-base-whitelist-284d.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.284d-purchases-base-whitelist.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/purchases 진입 (Cmd+Shift+R hard refresh)
2. 목록에 발주 5 status (전환대기/승인대기/확정/만료/보류) item 만 표시 확인
3. 견적 단계 item (sent/collecting/comparing) 0 확인
4. 비어있는 조직이면 "발주 전환 대기 중인 건이 없습니다" + 부카피 표시
5. 견적 관리 (/dashboard/quotes) 와 시각적으로 다른 화면임을 인지 가능

## 호영님 추가 보고 — #3/#4/#6 이미 land

이미 production land 됐는데 호영님이 stale cache 로 보고하신 항목:
- **#3 카드 본문** §11.284c (commit dpl_AbbncNN…jCw, 17807f17 line 770-798)
- **#4 "견적 상세 →" 버튼** §11.277b (수개월 전 land, 다음 단계로 이동 + setSelectedId)
- **#6 영문 잔여** §11.248a / §11.279c 등 다수 swap 완료

→ **Cmd+Shift+R hard refresh** 또는 PWA 캐시 삭제 후 재확인 권장.

## Phase 2 별도 spec 대기

호영님 Phase 2 spec (발주서 PDF / 결재 / 공급사 통보 / 그룹웨어 연동) 진입
시 별도 plan 문서 작성 (labaxis-feature-planner skill 호출).
