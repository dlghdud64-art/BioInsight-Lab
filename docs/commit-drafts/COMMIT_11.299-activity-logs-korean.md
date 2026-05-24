# §11.299 Commit Message Draft (호영님 P1 — 활동 로그 한글화)

```
fix(activity-logs): §11.299 #activity-logs-korean — 개발 용어 (ORDER_FOLLOWUP_GENERATED / 엔티티 유형) → 사용자 용어 (발주 후속 조치 생성 / 대상 구분) 한글화 (호영님 P1)

호영님 P1 (2026-05-24):
/dashboard/activity-logs 의 raw 영문 enum (ORDER_FOLLOWUP_GENERATED
/ EMAIL_SENT / ORDER) + "엔티티 유형" / "전체 엔티티" 개발 용어가
사용자 화면 노출. 일반 사용자 (시약 담당자/QC 실무자) 에게 비직관적.

Fix (1 file ~70 line + 1 NEW test):

- apps/web/src/app/dashboard/activity-logs/page.tsx:
  · ACTIVITY_TYPE_LABELS 30+ enum 확장 — 기존 9 → 30+ 항목:
    - 견적/리스트: QUOTE_STATUS_CHANGED / QUOTE_DRAFT_GENERATED /
      QUOTE_DRAFT_REVIEWED / QUOTE_DRAFT_STARTED_FROM_COMPARE
    - 비교: COMPARE_RESULT_VIEWED / COMPARE_SESSION_REOPENED /
      COMPARE_INQUIRY_DRAFT_STATUS_CHANGED
    - 이메일: EMAIL_DRAFT_GENERATED / EMAIL_SENT / VENDOR_REPLY_LOGGED
    - 발주: ORDER_FOLLOWUP_GENERATED / REVIEWED / SENT /
      ORDER_STATUS_CHANGE_PROPOSED / APPROVED / ORDER_STATUS_CHANGED
    - 재고: INVENTORY_RESTOCK_SUGGESTED / REVIEWED
    - 구매: PURCHASE_REQUEST_CREATED / CANCELLED / REVERSED /
      PURCHASE_RECORD_RECLASSIFIED
    - AI: AI_TASK_CREATED / OPENED / COMPLETED / FAILED
  · ENTITY_TYPE_LABELS 새 mapping (대소문자 혼재 cover):
    quote/QUOTE/product/PRODUCT/search/SEARCH/order/ORDER/inventory/
    INVENTORY/vendor/VENDOR/user/USER/email/EMAIL → 한글
  · 필터 라벨 swap:
    "엔티티 유형" → "대상 구분"
    "전체 엔티티" → "전체"
  · SelectItem 옵션 한글화 + 추가:
    리스트 → 견적, 발주/재고/공급사 추가 (기존 quote/product/search +
    order/inventory/vendor)
  · 카드 raw 표시 제거 + 한글 변환:
    log.activityType raw mono code 표시 제거 (Badge 가 이미 한글
    라벨 표시 — 중복 영문 표시 제거)
    log.entityType → ENTITY_TYPE_LABELS[type] || type fallback

- apps/web/src/__tests__/regression/activity-logs-korean-299.test.ts
  (NEW, 12 it × 5 nested describe):
  · §11.299 trace
  · ACTIVITY_TYPE_LABELS 확장 4 카테고리 검증
  · ENTITY_TYPE_LABELS 새 mapping + 대소문자 혼재
  · Filter 라벨 swap 3개
  · raw 영문 enum 카드 표시 제거 + 한글 변환
  · activityTypeFilter/entityTypeFilter state + COLORS/ICONS 보존

canonical truth 보존 (회귀 0):
- activityTypeFilter / entityTypeFilter useState + queryKey 보존
- handleResetFilters 보존
- ACTIVITY_TYPE_COLORS / ACTIVITY_TYPE_ICONS Record 보존 (기존
  9 값 + 확장 30+ 는 fallback color/icon 사용)
- log.activityType 자체 (server 응답 field) 변경 0
- entityTypeFilter API param (entityType) 변경 0

호영님 production effect:
1. 활동 로그 진입 → 필터 라벨 "활동 유형" / "대상 구분" (한글 통일)
2. drop 옵션 "전체" / "견적" / "제품" / "검색" / "발주" / "재고" /
   "공급사" 한글
3. 카드 Badge "발주 후속 조치 생성" (한글 라벨, raw enum 제거)
4. 카드 entityType "· 발주" (한글 변환)
5. FMAIL_SENT (호영님 화면 오타 추정) 별도 처리 0 — EMAIL_SENT 한글
   매핑으로 cover

FMAIL_SENT 확인:
grep "FMAIL" apps/web/src 전체 → 0 매치. 호영님 화면 캡처의 첫글자
잘림 (E 누락) 추정. 실제 enum 은 EMAIL_SENT 만 존재.

Out of Scope (별도 batch):
- 활동 로그 외 다른 surface (audit log / event feed) 영문 enum
  노출 audit
- 카드 표시 형식 자연어화 ("발주 후속 조치가 생성되었습니다")

Rollback path: git revert <SHA>
- 1 file ~70 line + sentinel test 삭제

Lessons:
1. enum mapping 누락 → raw 영문 노출 회귀 — schema 의 모든 enum
   값을 mapping 에 1:1 매핑하는 audit 가 필수
2. 대소문자 혼재 cover — server 응답이 quote vs QUOTE 둘 다 가능
   할 때 양쪽 매핑
3. Badge 한글 라벨 + 별도 raw mono code 중복 표시 제거 — UX
   cleanliness
4. Karpathy minimum-diff — 1 file ~70 line + 1 NEW test (12)
```

## Push

```bash
git add apps/web/src/app/dashboard/activity-logs/page.tsx \
        apps/web/src/__tests__/regression/activity-logs-korean-299.test.ts \
        docs/commit-drafts/COMMIT_11.299-activity-logs-korean.md

git commit -F docs/commit-drafts/COMMIT_11.299-activity-logs-korean.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard/activity-logs Cmd+Shift+R
2. 필터 라벨: "활동 유형" + "대상 구분" (엔티티 유형 0)
3. drop 옵션: 전체 / 견적 / 제품 / 검색 / 발주 / 재고 / 공급사
4. 카드 Badge: "발주 후속 조치 생성" / "이메일 발송" / "비교 결과
   조회" 등 (raw 영문 enum 0)
5. 카드 entityType: "· 발주" / "· 견적" (한글 변환)
6. FMAIL_SENT 없음 (호영님 화면 오타 — EMAIL_SENT 가 정상)
