# NOTE — §11.359 모바일 네비게이션 구조 Phase 0 진단 (코드 기반)

* Status: 🔍 Phase 0 완료 (read-only, 추측 없음). 2026-06-03.
* 대상: `apps/mobile`. ⚠️ **CEO 스크린샷(이미지1/2) 전제와 repo HEAD 코드가 상당히 불일치** — 아래는 코드 기준 사실.

## 판정 요약
| # | 항목(전제) | 코드 사실 / 판정 |
| :- | :-- | :-- |
| 1 | 햄버거 vs 더보기 중복 | **햄버거 드로어 코드 부재.** 실제 중복 = more.tsx(live 더보기 탭) vs **profile.tsx(orphan, 도달불가)** |
| 2 | 더보기 닫기 부재 | more.tsx = **하단탭의 한 탭**(풀페이지/시트 아님) → 닫기 불요. **결함 아님** |
| 3 | 로그아웃 부재(최우선) | **틀림 — more.tsx 더보기 탭에 로그아웃 존재**(handler + red 버튼). 부재 아님 |
| 4 | 브리핑 FAB 위치 불일치 | 모바일 **운영 브리핑 FAB 부재.** detail의 absolute-bottom = 하단 액션바(이미 동일 패턴 정합) |

## 1. 햄버거 vs 더보기 — 햄버거 드로어 코드 없음
- `Drawer/createDrawer/<Menu/openDrawer/toggleDrawer/hamburger` grep = **0건**(app+components 전역). §11.358-3 통일한 AppHeader 에도 메뉴 아이콘 없음.
- 실제 메뉴 화면 2개: `app/(tabs)/more.tsx`(visible 탭 "설정", 계정/설정/지원 섹션 + 로그아웃) + `app/(tabs)/profile.tsx`("내 정보" + 로그아웃).
- **profile.tsx = orphan**: `_layout.tsx` 에 `href: null`(탭 숨김) + `/profile` 로 가는 네비게이션 **0건** → **도달 불가 dead 화면.**
- **판정: "햄버거 vs 더보기" 중복 아님.** 실제 = live 더보기(more) vs orphan profile. **정본 = more.tsx**, profile.tsx 는 dead(정리 대상). (스크린샷 "햄버거 풀 메뉴"는 구버전 또는 profile 직접 렌더 추정 — 현 코드엔 진입점 없음.)

## 2. 더보기 닫기 버튼 — 탭이라 불요
- more.tsx 는 `Tabs.Screen name="more"`(하단탭). 풀페이지 push/시트 아님 → 닫기/뒤로 UI 불요(다른 탭 탭으로 이동, dead-end 아님).
- **판정: 결함 아님**(탭 구조 의도).

## 3. 로그아웃 — 존재 (전제 틀림)
- `more.tsx`: `handleLogout`(line 28, SecureStore 삭제 + login replace) + 하단 **red "로그아웃" 버튼**(line 160-166). 하단탭 "설정"이라 **항상 접근 가능.**
- `profile.tsx`: 로그아웃 있으나 orphan(도달 불가).
- **판정: 로그아웃 부재 아님.** 접근성 정상(more 탭). 단 orphan profile 중복 로그아웃은 정리 시 함께 제거.

## 4. 브리핑 FAB — 모바일 부재 (전제 미해당)
- 운영 브리핑 FAB grep 0(§11.358 #2 재확인). detail 화면(inventory/purchases/quotes [id])의 `absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-3 pb-8` = **하단 sticky 액션바**(floating round FAB 아님). 3화면 동일 패턴 → 이미 정합.
- **판정: 브리핑 FAB 해당 없음.** 액션바는 일관(불일치 아님).

## 결론 / 권장
- **§11.359 라이브 결함 = 거의 없음.** #2/#3/#4 는 전제가 코드와 불일치(작업 없음).
- **유일한 실제 정리거리 = profile.tsx orphan**(도달 불가 dead 화면 + 로그아웃 중복). → **§11.359-1**: profile.tsx 제거(또는 진입점 부여). 단 화면 파일 삭제이므로 호영님 확인 후. 정본 more.tsx 로 일원화 권장.

---
## §11.359-1 처리 (호영님 (a)제거 승인, 2026-06-03)
- ✅ `_layout.tsx` `<Tabs.Screen name="profile" href:null>` 등록 라인 제거(편집 완료).
- ⚠️ `profile.tsx` 삭제는 sandbox 권한상 Claude unlink 불가 → **호영님 `git rm` 필수.**
- ⚠️ **expo-router 파일 기반 라우팅**: 파일이 남고 _layout 라인만 빠지면 profile 이 보이는 탭으로 역출현(회귀). → `git rm` 누락 금지.
- commit-draft: COMMIT_11.359-1.
- 스크린샷 기반 전제가 어긋난 이유: §11.358-3 헤더 통일 직후 상태이거나, profile 화면이 과거 진입점에서 보였을 가능성. 현 코드 기준 햄버거·로그아웃부재는 사실 아님.
