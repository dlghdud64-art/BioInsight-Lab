# §11.296 Commit Message Draft (호영님 — Header 3 dropdown 완료)

```
fix(dashboard): §11.296 #header-notification-plain-button — Header 알림 dropdown plain button 단순화 + Radix import 제거 (호영님 §11.283b/§11.295 패턴, Header 3 dropdown 완료)

호영님 권장 (2026-05-24):
§11.283b 햄버거 / §11.295 도움말+프로필 plain button 패턴 정합 —
Header.tsx 3 dropdown 마지막 (알림) 도 plain button + useState +
조건부 backdrop + role="menu" pattern 으로 단순화.

알림 dropdown 의 notifications list + 읽음 처리 + Mark all read
복잡 logic 은 모두 보존 (UI render layer 만 swap).

Fix (1 file ~30 line swap + import cleanup + 1 NEW test):

- apps/web/src/components/dashboard/Header.tsx:
  · 알림 dropdown (line 324-433, 109 line):
    - <DropdownMenu open={isNotificationOpen}> + <DropdownMenuTrigger
      asChild><Button> + <DropdownMenuContent> 제거
    - plain <button aria-label="알림" aria-expanded aria-haspopup>
      + Bell icon (pointer-events-none) + unreadCount badge
    - 조건부 backdrop (fixed inset-0 외부 click close) +
      <div role="menu" aria-label="알림 메뉴">
    - 헤더 (알림 label + unread count + "모두 읽음" button) 보존
    - notifications.slice(0, 8).map 알림 목록 보존
      (isRead / handleNotificationClick / 카테고리 아이콘 /
      buildNotificationText / formatNotificationTime / 미독 파란 점)
    - 푸터 (Link "전체 알림 보기" + setIsNotificationOpen(false)) 보존
  · Radix DropdownMenu* import 6종 제거 (line 22-29):
    - DropdownMenu / DropdownMenuContent / DropdownMenuTrigger /
      DropdownMenuItem / DropdownMenuLabel / DropdownMenuSeparator
    - 3 dropdown 모두 plain button 으로 swap 완료 → import dead

- apps/web/src/__tests__/regression/header-notification-plain-button-296.test.ts
  (NEW, 13 it × 3 nested describe):
  · §11.296 trace + 알림 plain button + aria-expanded + Bell badge +
    조건부 render + notifications.slice + isRead 분기 +
    handleNotificationClick + 모두 읽음 button + 푸터 Link +
    helper 함수 5종 (eventTypeToCategory / CATEGORY_CONFIG /
    renderCategoryIcon / buildNotificationText / formatNotificationTime)
  · Radix import 부재 + DropdownMenu/Trigger/Content/Item 사용 부재
  · §11.295 도움말+프로필 + §11.282-a 햄버거 + §11.271 BarcodeScanFab 보존

canonical truth 보존 (회귀 0):
- isNotificationOpen useState 그대로
- unreadCount / notifications / handleMarkAllRead /
  handleNotificationClick state + handler 모두 보존
- eventTypeToCategory / CATEGORY_CONFIG / renderCategoryIcon /
  buildNotificationText / formatNotificationTime helper 보존
- isRead 분기 + 카테고리 아이콘 + 미독 파란 점 + 카테고리 label
  + 시간 표시 보존
- 푸터 Link "/dashboard/notifications" + onClick close 보존
- §11.295 도움말 + 프로필 plain button 보존
- §11.282-a 모바일 햄버거 Menu icon pointer-events-none 보존
- §11.271 BarcodeScanFab inline mount 보존

호영님 production effect (Vercel READY 후):
1. Bell button click → plain dropdown 즉시 열림 (Radix 의존성 0)
2. 알림 목록 표시 + 미독 파란 점 + 카테고리 아이콘 + 시간
3. "모두 읽음" click → handleMarkAllRead 정상 작동
4. 알림 click → handleNotificationClick → navigate + 읽음 처리
5. "전체 알림 보기" click → /dashboard/notifications + dropdown close
6. 외부 click → backdrop close
7. unreadCount badge 정상 표시
8. 호영님 환경 Radix silent fail 완전 차단 (3 dropdown 모두 plain)

Out of Scope (별도 batch):
- Esc keydown close
- Arrow keys navigation (Tab cycling)
- Focus trap (focus within menu)
- 알림 종류별 grouping / filter

Rollback path: git revert <SHA>
- 1 file ~30 line + import 복원 → Radix DropdownMenu 회귀 +
  호영님 환경 silent fail 위험 재발

Lessons:
1. Header.tsx 3 dropdown (햄버거 §11.282-a 포함 시 4 → 5 surface)
   모두 plain button 단순화 완료. dashboard surface Radix wiring 0
2. 복잡 logic (notifications list / 읽음 처리) UI render swap 만
   으로도 Radix 회피 가능. handler/state 변경 0
3. Radix import 제거 — dead import cleanup 으로 maintenance ↑
4. preemptive 차단 패턴 완성 — 호영님 환경 silent fail 모든 surface
5. Karpathy minimum-diff — 1 file ~30 line + import + 1 NEW test (13).
   notifications logic / state / handler 변경 0
```

## Push

```bash
git add apps/web/src/components/dashboard/Header.tsx \
        apps/web/src/__tests__/regression/header-notification-plain-button-296.test.ts \
        docs/commit-drafts/COMMIT_11.296-header-notification-plain-button.md

git commit -F docs/commit-drafts/COMMIT_11.296-header-notification-plain-button.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard Cmd+Shift+R
2. 우상단 Bell button click → 알림 dropdown 즉시 열림
3. 알림 목록 표시 (미독 파란 점 / 카테고리 아이콘 / 시간)
4. unreadCount badge 정상
5. "모두 읽음" click → 알림 모두 읽음 처리
6. 알림 click → 해당 페이지 navigate + dropdown close
7. "전체 알림 보기" click → /dashboard/notifications + close
8. 외부 click → close

## Header.tsx 3 dropdown 종료

| dropdown | § | 상태 |
|---|---|---|
| 햄버거 (모바일) | §11.282-a | ✅ Menu icon pointer-events-none (이전) |
| 도움말 | §11.295 | ✅ plain button (이전 push) |
| 프로필 | §11.295 | ✅ plain button (이전 push) |
| **알림** | **§11.296** | ✅ **plain button (이번)** |

Header.tsx Radix DropdownMenu wiring 0. 호영님 환경 silent fail
완전 차단 완료.
