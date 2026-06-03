# COMMIT — §11.359-1: orphan profile 화면 제거 (more.tsx 일원화)

```
refactor(mobile) §11.359-1 #remove-orphan-profile — 도달 불가 profile.tsx(중복 메뉴/로그아웃) 제거 + 탭 등록 정리, 메뉴 정본을 more.tsx 로 일원화
```

## 무엇 (§11.359 Phase 0 결론 — 유일 실제 정리거리)
- `app/(tabs)/profile.tsx` = **orphan**: `_layout.tsx` `href:null`(탭 숨김) + `/profile` 네비게이션 0건 → 도달 불가 dead 화면. more.tsx 와 프로필/로그아웃 기능 중복(CEO 가 본 "중복"의 정체).
- 정본 = `more.tsx`(live 더보기 탭, 계정/설정/지원 + 로그아웃). profile.tsx 제거로 일원화.

## Fix
- `app/(tabs)/_layout.tsx`: `<Tabs.Screen name="profile" options={{ href: null }} />` 라인 제거. (편집 완료)
- `app/(tabs)/profile.tsx`: **삭제(git rm)** — sandbox 권한상 Claude 가 직접 unlink 불가 → 호영님 `git rm` 필수.

## ⚠️ 중요 (expo-router 파일 기반 라우팅)
- expo-router 는 `(tabs)/` 내 **파일 존재만으로 탭 자동 등록**. 기존 `href:null` 가 profile 을 숨겨왔음.
- 따라서 **파일을 반드시 `git rm` 해야 함.** 만약 _layout 라인만 빠지고 파일이 남으면 profile 이 **보이는 탭으로 역출현(회귀).** → push 시 `git rm` 누락 금지.

## 검증
- 모바일 test 없음 → grep: `_layout.tsx` profile 참조 0 확인. 파일 삭제는 git rm 으로 확정(호영님 환경).
- 로그아웃 접근성 무영향: more.tsx 더보기 탭 로그아웃 그대로(정본).

## migration / 데이터
- 없음. dead 화면 1개 제거(사용자 도달 0이라 UX 영향 0, 유지보수 혼선 제거).

## Rollback
- `git revert` 또는 profile.tsx 복원 + _layout 라인 복구.
```
footer 없음
```
