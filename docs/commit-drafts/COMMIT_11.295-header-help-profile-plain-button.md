# §11.295 Commit Message Draft (호영님 권장안)

```
fix(dashboard): §11.295 #header-help-profile-plain-button — Header.tsx 도움말 + 프로필 DropdownMenu plain button 단순화 (호영님 §11.283b 패턴 정합, preemptive Radix silent fail 차단)

호영님 권장안 (2026-05-24):
§11.283b 햄버거 Radix 제거 패턴 정합 — Header.tsx 의 도움말 +
프로필 2 DropdownMenu 도 plain button + useState + 조건부 backdrop
+ role="menu" pattern 으로 단순화.

알림 dropdown (109 line, notifications list 복잡 logic) 별도 batch.

Fix (1 file ~150 line swap + 1 NEW test):
- apps/web/src/components/dashboard/Header.tsx:
  · isHelpOpen + isProfileOpen useState 추가
  · 도움말: Radix DropdownMenu 5종 제거 + plain <button> + 조건부
    backdrop + <div role="menu"> + 3 Link (운영 매뉴얼/문제 해결/지원)
  · 프로필: Radix DropdownMenu 6종 제거 + plain <button> +
    Avatar 보존 + 조건부 backdrop + <div role="menu"> + 4 menuItem
    (설정/청구/고객센터/로그아웃)
  · pathname / fromParam / signOut sequence 모두 보존

회귀 0:
- 알림 DropdownMenu (isNotificationOpen) 변경 0 (별도 batch)
- DropdownMenu/Trigger/Content/Item import 유지 (알림 사용)
- 사용자 정보 (name/email/Avatar) 표시 보존
- 로그아웃 sequence 보존
- §11.282-a 모바일 햄버거 보존

호영님 production effect:
1. 도움말 / 프로필 button click → plain dropdown 즉시 열림
2. menuItem click → navigate + close
3. 외부 click → close
4. 알림 dropdown 은 기존 Radix (별도 batch)
5. 호영님 환경 Radix silent fail preemptive 차단

Out of Scope (별도 batch):
- 알림 dropdown plain button 단순화
- Esc / Arrow keys / focus trap

Lessons:
1. §11.283b 패턴 재사용
2. 알림 분리 — 복잡 logic risk 분산
3. preemptive Radix silent fail 차단
4. visible UI 변화 0 (trigger + content swap)
5. Karpathy minimum-diff — 1 file ~150 line + 1 NEW test (13)
```

## Push

```bash
git add apps/web/src/components/dashboard/Header.tsx \
        apps/web/src/__tests__/regression/header-help-profile-plain-button-295.test.ts \
        docs/commit-drafts/COMMIT_11.295-header-help-profile-plain-button.md

git commit -F docs/commit-drafts/COMMIT_11.295-header-help-profile-plain-button.md
git push origin main
```

## Production smoke

1. labaxis.co.kr/dashboard Cmd+Shift+R
2. 도움말 button (?) click → dropdown 즉시 열림 (3 link)
3. menuItem click → navigate + close
4. 외부 click → close
5. 프로필 (Avatar) click → dropdown 즉시 열림 (4 menuItem)
6. 설정/청구/고객센터/로그아웃 모두 정상
7. 알림 (Bell) dropdown 기존 Radix 그대로
8. 모바일 햄버거 정상
```
