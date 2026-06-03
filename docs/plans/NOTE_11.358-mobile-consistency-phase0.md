# NOTE — §11.358 모바일 일관성·견적 fetch Phase 0 진단 (코드 기반)

* Status: 🔍 Phase 0 완료 (read-only, 추측 없음). 2026-06-03.
* 대상: `apps/mobile` (Expo/React Native). 6항목 판정.

## 판정 요약
| # | 항목 | 판정 | 성격 |
| :- | :-- | :-- | :-- |
| 1 | 견적 불러오기 실패 | 인증·라우트 **정상** → 환경값(API URL) 의심 | 코드 결함 아님(ops) |
| 2 | 운영 브리핑 위치 불일치 | 모바일 **미구현**(브리핑 0건) | 해당 없음(web 개념) |
| 3 | 헤더 문법 불일치 | **공통 헤더 없음 확정** → 신규 필요 | 정합 트랙 ✅ |
| 4 | 긴급재발주 배지 색상 | amber 사용 → §11.302 yellow sweep | 무해 |
| 5 | 안전 KPI 오버플로우 | 모바일 **안전화면 부재** | 해당 없음 |
| 6 | 스캔 CTA 중복 | **중복 아님**(글로벌 헤더 스캔 없음) | 정리 불필요 |

## 1. 견적 "불러오기 실패" — 코드상 모바일 전용 버그 아님
- `useQuotes` → `apiClient.get("/api/quotes")` (Bearer 토큰 자동 삽입, `lib/api.ts`).
- `/api/quotes` GET(line 395) = `getAuthUser(session, request)` → 웹 세션 **+ 모바일 Bearer 폴백**(`lib/auth/mobile-jwt.ts` `verifyMobileToken`).
- 서명/검증 secret 동일: signin·refresh·verify 모두 `MOBILE_JWT_SECRET || AUTH_SECRET`. signin 은 env 미설정 시 FATAL → prod 엔 설정됨.
- ∴ 인증 경로·라우트 **정상**. 구조적 "모바일만 실패" 유일 후보 = `lib/api.ts` `API_BASE_URL = EXPO_PUBLIC_API_URL ?? "http://localhost:3000"` — 빌드에 `EXPO_PUBLIC_API_URL` 미주입 시 기기에서 localhost 로 가 전 API 실패.
- **판정: 코드 결함 아님 → 빌드/ops 환경값(`EXPO_PUBLIC_API_URL`) 1순위 의심.** 확인 필요: 실패가 견적만인지 전체 탭인지(전체면 API URL 확정). 재현 시 실제 status/error 캡처.

## 2. 운영 브리핑 — 모바일 미구현
- `브리핑/briefing/FAB` grep = 0건(앱 전역). 모바일엔 브리핑 버튼 자체가 없음.
- **판정: 위치 불일치는 web 이슈.** 모바일 정합 대상 아님(신규 도입은 별도 결정).

## 3. 헤더 문법 불일치 — 공통 헤더 신규 필요 ✅ → **구현 완료(§11.358-3, 2026-06-03)**
> `components/AppHeader.tsx` 신설(title/subtitle/right) → 5탭(index/inventory/quotes/purchases/more) 전부 치환. index font-extrabold/pb-2 → 공통 font-bold/pb-3 정합. grep 검증(잔재 0). commit-draft: COMMIT_11.358-3.

- `app/(tabs)/_layout.tsx` `headerShown: false` → 각 화면이 **인라인 헤더 개별 구현**.
- 예: index = `LabAxis`(text-lg font-extrabold) + 동적 서브텍스트(흰 배경 border-b). 타 탭(inventory/quotes/purchases)은 헤더 구조 제각각, 공통 `<AppHeader>` 부재.
- **판정: 공통 모바일 헤더 컴포넌트 없음 → 신규 도입으로 통합(정합 트랙).** page-per-feature 회귀 방지.

## 4. 긴급재발주 배지 색상 — 무해(§11.302 sweep)
- `app/inventory/[id].tsx` lot 카드 임박 상태 = `border-amber-300 bg-amber-50` / `text-amber-600`.
- CLAUDE.md §11.302: amber/orange 금지 → yellow. **판정: 색상 토큰 sweep 대상(무해).**

## 5. 안전 KPI 오버플로우 — 모바일 안전화면 부재
- `find app -iname *safet*` = 0, `more.tsx` 메뉴에 안전 없음(있는 건 "웹에서 열기").
- **판정: 모바일에 안전관리 화면 없음 → KPI 오버플로우 해당 없음.** (web 안전화면 mock 은 §11.357/B-1 별도.)

## 6. 스캔 CTA 중복 — 중복 아님
- 글로벌 헤더 스캔 아이콘 **없음**(headerShown false). 스캔 = 홈(index) quick-action(`QrCode → /scan`) 1곳 + `/scan` 라우트. 견적 등 타 탭엔 스캔 버튼 없음.
- **판정: 중복 없음 → 정리 불필요.**

## 결론 / 권장
- **라이브 코드 결함으로 확정된 건 없음.** 최우려 #1(견적 fetch)은 코드상 인증·라우트 정상 → **환경값(EXPO_PUBLIC_API_URL) 확인이 먼저**(코드 수정 아님).
- 실제 코드 작업거리: **#3 공통 모바일 헤더(정합)**, **#4 amber→yellow sweep(무해)**. 둘 다 §11.302/§11.311 모바일 원칙 트랙.
- #2·#5·#6 은 전제(존재 가정)가 코드와 불일치 → 작업 없음.
