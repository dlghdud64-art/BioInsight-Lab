# 핸드오프 — 로그인 상태 메뉴 단일화 (§menu-unify)

- **결정 (호영님 2026-06-28):** **(a) 팝업으로 통일** — 축약 햄버거 제거, 캐논 풀셋 메뉴로 수렴.
- **상태:** ⏳ 계획(구현 전). live `apps/web` 코드.

---

## 0. 문제 (결함)

로그인 상태에서 **메뉴 surface 가 ≥2 종** 떠 있음 (1 종이어야 정상):

| surface | 위치 | 항목 | 다크 토큰 | 로그아웃 |
|---|---|---|---|---|
| **축약 (잔재)** | `app/_components/bioinsight-hero-section.tsx` (랜딩 히어로 자체 nav) | 대시보드 / 검색 / 계정 설정 / 로그아웃 · **프로필 없음** | 순흑 계열 | (확인 필요) |
| **풀셋 (캐논 가까움)** | `app/_components/main-header.tsx` 모바일 Sheet (L147–263) | 프로필 + 대시보드 / 견적 관리 / 구매 운영 / 재고 관리 / 고객 지원 및 문의 / 로그아웃 | `#0D1A2D` / hover `#142840` | `#F87171` (red-400, 약함) |
| **데스크탑 드롭다운** | `components/auth/user-menu.tsx` | 프로필 + 대시보드/견적/구매/재고/설정/청구/고객센터/로그아웃 | `bg-white` (라이트) | `hover:bg-slate-100` (red 없음) |

**캐논 로그아웃 danger 패턴:** `components/layout/bottom-nav-more-sheet.tsx` L194 — `text-red-600 hover:bg-red-50` (구분선 + 강한 red).

---

## 1. 표준 (택1 — (a) 확정)

로그인 상태 메뉴 = **단일 풀셋**(프로필 + 제품 메뉴 전체). 대시보드 사이드바와 동일 = canonical. 축약(대시보드/검색/계정설정)은 비로그인 마케팅 내비 잔재 → 제거.

---

## 2. 작업 묶음 (3)

### ① 로그인 메뉴 컴포넌트 단일화
- `bioinsight-hero-section.tsx` 의 **로그인 상태 축약 메뉴(대시보드/검색/계정설정) 제거** → 캐논 풀셋(main-header Sheet 또는 user-menu)으로 교체. 또는 랜딩이 `MainHeader` 를 쓰도록 정리.
- 로그인 상태 = 메뉴 1종(풀셋)만 노출. 비로그인 마케팅 내비는 비로그인 분기에만.
- ⚠️ 라우팅·항목 기능 변경 0 (동선 동일), page-per-feature 0.

### ② 다크 토큰 단일화
- drawer/popover 가 **같은 다크 토큰** 사용. main-header `#0D1A2D` / hover `#142840` 기준으로 통일(축약의 순흑 계열 폐기).
- `user-menu.tsx`(데스크탑 드롭다운) = `bg-white` 라이트라 별 surface — **정책 명시 필요**: 데스크탑 라이트 유지 vs 다크 통일. (모바일 drawer 끼리는 다크 통일이 우선.)

### ③ 로그아웃 danger 스타일 정렬
- 캐논 = `bottom-nav-more-sheet.tsx` L194 `text-red-600 hover:bg-red-50` + 구분선.
- 적용 대상: main-header `#F87171`→캐논, user-menu `slate-100`(red 없음)→캐논, (잔재 제거 후 불필요분 제외).

---

## 3. 게이트 / 주의

- 구현 전 **라이브 스크린샷 ↔ 컴포넌트 1:1 재대조**(축약 메뉴가 home 외 다른 surface 에도 뜨는지 확인).
- 결합 sentinel 점검(메뉴 항목·로그아웃 진입점 단언이 있을 수 있음, 예: §11.359 더보기 시트 로그아웃).
- 색상은 ① 단일화 시 자동 해소(같은 컴포넌트면 토큰 1개). ②는 잔존 surface 정책 결정용.
- operator-shell 권위(vitest/build/push), cowork = 코드+정적검증.

## 4. Out of Scope
- 메뉴 항목 추가/기능 변경 · 신규 page · 데스크탑 user-menu 라이트→다크 강제(별 결정).
