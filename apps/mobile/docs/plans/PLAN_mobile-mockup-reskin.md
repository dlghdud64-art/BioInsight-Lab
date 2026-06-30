# Implementation Plan: 모바일 목업 4종 재스킨 (대시보드·견적·재고·입고)

- **Status:** ✅ Complete (sandbox static) — Phase 0 셸 · 1 재고 · 2 견적 · 3 대시보드 · 4 입고+탭IA 전부. 잔여=operator(vitest/빌드/기기/push) + receiving API 후속(입고 문서게이트 큐).
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30

**CRITICAL:** phase별 quality gate 통과 후 다음 진행. dead button/no-op/placeholder success 금지. push=operator-shell 단독.

## 0. Truth Reconciliation

**Latest Truth Source:** 호영님 업로드 `design_handoff`(2026-06-30) — README + 4 HTML 목업(01 대시보드/02 견적/03 재고/04 입고) + assets(inbound-mobile.jsx/.css). High-fidelity, 토큰 확정.

**현황(실측):**
- RN 모바일 = Expo + expo-router Tabs + NativeWind v4 + lucide-react-native.
- 기존 화면 존재: `app/(tabs)/index`(대시보드)·`quotes`·`purchases`·`inventory`·`more` + `scan.tsx`. → **재스킨**(greenfield 아님).
- 기존 탭 5개(홈·견적·구매·재고·설정) vs 목업 6탭(대시보드·견적·입고·재고·분석·더보기).

**Conflicts Found → 해소(호영님 2026-06-30 확정):**
1. **amber 토큰** — ✅ 확정 `#b45821`(muted brownish). §11.302 갱신("쨍한 yellow 금지, 주의색=muted #b45821"). CLAUDE.md + tailwind 주석 반영, **배포 게이트 해제**. 의미=주의·만료임박(위험=rose / 정상=emerald 와 구분).
2. **no-op** — 셸 onPress 필수 prop 으로 강제(미지정=미렌더). 화면별 wiring 검증 유지.
3. **탭 IA** — ✅ 확정 **5탭: 대시보드 · 견적 · 입고 · 재고 · 더보기**. 홈→대시보드(rename), 구매→더보기 강등(데스크탑 성격 발주생성), 입고 신규 daily 탭 승격(QR 스캔 입고=모바일 핵심), 분석→더보기, 설정→더보기. iOS ≤5탭 권장(6탭 44px 깨짐 회피). 더보기=구매운영·발주·지출분석·구매리포트·예산·조직·안전·설정. **적용 시점: Phase 4**(입고 화면 신설과 동시 — 그 전 적용 시 입고 탭이 dead route).
4. 가짜 폰 베젤 제거(README 명시) — RN 은 OS 상태바 + safe-area.

**Chosen Source of Truth:** 실측 RN 구조 + README 디자인. 충돌 2건 전부 호영님 확정 완료.

## 1. Priority Fit
- [x] 호영님 직접 지시(우선). 기존 화면 시각 일관성 향상. P1/blocker 단정 아님 — UI redesign 트랙.

## 2. Work Type
- [x] Mobile · Design Consistency (재스킨, 멀티-surface)

## 3. Scope & Constraints
- same-canvas 유지, page-per-feature 금지. 서버=truth, 모바일=cache/pending. 셸=표시/네비/액션 트리거(mutation 0).
- Out of Scope: 신규 분석 대시보드 기능, 탭 IA 확정(별 결정), 데이터 바인딩(화면별 phase).

## 4. Phases

### Phase 0: Design Tokens + 공통 셸 — ✅ Complete
- `tailwind.config.js`: navy/accent/emerald/amber(⚠)/rose/violet/ink/surface + radius(card/field/control) + fontFamily(Pretendard/mono). primary 하위호환 유지.
- 공통 셸(`components/shell/`): `ScreenHeader`(navy+요약스트립, safe-area, 액션 onPress 강제), `ScreenScaffold`(헤더+스크롤 본문, 스크롤바 숨김, refresh), `FilterChips`(controlled 단일선택, danger 톤), `MoreSheet`(Modal+Animated 슬라이드, 그룹/로그아웃 danger, 항목 onPress 강제), `index.ts` 배럴.
- 검증: tailwind config require OK, 셸 5파일 transpileModule PARSE OK. radius `rounded-r-*` 충돌 회피(개명). vitest/빌드/기기=실행 불가→operator.
- ✅ amber 게이트 해제(호영님 확정 + CLAUDE.md §11.302 갱신). 토큰/셸 additive → 기존 회귀 0, push 가능.

### Phase 1: 03 재고 화면 재스킨 — ✅ Complete (sandbox static)
- `app/(tabs)/inventory.tsx` 재작성: ScreenHeader(navy+요약스트립: 전체/안전재고 미달 alert/만료임박) + 재발주 추천 배너(로즈, 부족분 큰 1건·실 gap만) + FilterChips(전체/부족 danger/만료임박/위치미지정) + 품목 카드(상태 배지 §11.302·안전재고 게이지·LOT/위치 미지정 로즈/D-day amber) + 검색 토글.
- 데이터: useInventory(서버 truth). 만료임박/부족/위치 파생은 클라이언트(가짜 수량 0).
- 액션 wiring(no-op 0): 카드/상세/재발주검토 → `/inventory/[id]`, 스캔 → `/scan`, 알림 → `/notifications`. 상태(loading/error retry/empty 필터vs전역/refresh) 보존.
- 검증: transpileModule PARSE OK(371줄). 라우트 3종 실재 확인. 제거 임포트 잔존 0. EmptyState/ErrorState props 정합.
- ⚠️ 파일도구(Write/Edit) 대형 파일 truncate 재발 → bash heredoc(disk-authoritative)로 기록. vitest/빌드/기기=operator.
- 미해결(후속): 전용 재발주 mutation/sheet 없음 → 현재 "재발주 검토"=상세 라우팅(실 네비). dispose>reorder(§12)는 detail surface 책임.

### Phase 2: 02 견적 재스킨 — ✅ Complete (sandbox static)
- `app/(tabs)/quotes.tsx` 재작성: ScreenHeader(요약: 진행중/회신대기 alert/비교검토) + "지금 할 일" navy 카드 + 단계 칩(전체/발송대기/회신추적/비교검토/승인·입고) + 케이스 카드(단계 레일색·단계 pill·금액·요청자·상대시각·next-step) + 검색 토글.
- **정직 매핑**: Quote 실필드(title/status/totalAmount/itemCount/requesterName/updatedAt)만. 목업의 우선순위·마감 D-day·공급사 수·회신 진행바는 API 미제공 → **미표기(가짜 0)**. status→5단계 매핑(발송대기 accent/회신추적 amber/비교검토 violet/승인·입고 emerald).
- **AI 충돌 해소**: 목업 "AI 추천 .ai" → CLAUDE.md "AI/chatbot UI 신규 금지" 준수 위해 **"지금 할 일"(contextual next-step)**로 재해석, AI 브랜딩 제거. 우선건=실필드 휴리스틱(s2 최장 미갱신→s1).
- 액션 wiring(no-op 0): 모든 카드/지금할일/next-step → `/quotes/[id]`, 알림 → `/notifications`. loading/error retry/empty/refresh 보존.
- 검증: transpileModule PARSE OK(319줄). 라우트 실재. 제거 임포트 잔존 0. vitest/빌드/기기=operator.

### Phase 3: 01 대시보드 재스킨 — ✅ Complete (sandbox static)
- `app/(tabs)/index.tsx` 재작성: ScreenHeader(navy + KPI 요약 3: 처리필요 alert/승인대기/진행중) + "지금 할 일" navy 카드(최우선 1건, AI 아님) + 파이프라인(견적→입고→재고 nav) + 바로가기(기존 3상태 wiring 보존) + 지출 요약(실 구매 합계) + 최근 구매.
- **보존(필수)**: 오프라인 sync(getPendingCount/triggerSync/handleConfirmedSync 배너) · ScanHubSheet · 3상태(zero/active/blocked) · 퀵액션 라우팅 · 최근구매. §6 오프라인 의무 유지.
- **정직**: DashboardSummary 실필드 + purchases 만. 지출 "분석" 차트 데이터 없음 → 최근 구매 합계(실값)로 축소(가짜 차트 0). 입고 파이프라인 세그=스캔허브 진입(입고 탭 Phase 4 전).
- 액션 wiring(no-op 0): 탭/디테일/스캔허브 실연결(라우트 4종 실재). amber 토큰(오프라인 배너).
- 검증: transpileModule PARSE OK(347줄). 보존 6종·iconColor 키·라우트 확인. vitest/빌드/기기=operator.

### Phase 4: 04 입고 + 탭 IA — ✅ Complete (sandbox static)
- **차단 발견·정직 처리**: receiving/문서게이트 큐 API 부재(목업 CASES=데모). 가짜 데이터 금지 → 목업 문서게이트 큐는 **백엔드(receiving API) 후속**. 호영님 확정="실 입고 허브 + IA".
- `app/(tabs)/inbound.tsx` 신설(실기능 허브): QR 라벨 스캔 입고(navy primary → /scan intent=receive_label) + 직접 입고(/inventory/lot-receive) + 최근 입고·구매(실 usePurchases → /purchases/[id]) + 오프라인 반영 대기(getPendingCount/triggerSync) + 요약(반영대기 alert/이번달 입고/최근 구매).
- **탭 IA 5탭**(`_layout.tsx`): 대시보드(index)·견적·입고(신규)·재고·더보기. 홈→대시보드 rename, 구매·검색 href:null(강등). 입고 탭=실 화면이라 dead route 0.
- `more.tsx`: "구매 운영" 섹션 추가(구매 내역→/(tabs)/purchases, 구매 등록→/purchases/register) — 강등 구매 접근 보장, dead button 0. 미사용 import 제거.
- 검증: 전체 (tabs) 7 + shell 4 transpileModule ALL PARSE OK. 라우트 실재. vitest/빌드/기기=operator.
- 후속(백로그): receiving API 신설 시 입고 문서게이트 큐(CoA/MSDS 게이트·시급도 정렬) 실데이터로 구현.

## 5. Risks
| Risk | Mit |
| :-- | :-- |
| amber §11.302 충돌 배포 | 확정 전 배포 게이트, 토큰 격리 주석 |
| no-op 회귀 | 셸 onPress 필수 prop, 화면별 wiring 검증 |
| 탭 IA 변경 부작용 | Phase 4 분리, 호영님 확정 후 |
| NativeWind 미지원 유틸 | RN 지원 유틸/StyleSheet 한정, transpile 검증 |
| RN 빌드 sandbox 불가 | static parse + operator 기기 QA |

## 6. Rollback
- Phase 0: 토큰/셸은 additive(기존 화면 미사용 → 영향 0). config revert + components/shell 삭제.
- 화면별 phase: 해당 화면 파일 revert(셸 잔존).

## 7. Notes
- ✅ 호영님 확정 완료: ① amber `#b45821`(§11.302 갱신) ② 탭 IA 5탭(대시보드·견적·입고·재고·더보기, Phase 4 적용).
- Pretendard: 토큰만 선반영. 실제 폰트 번들+expo-font 로드는 화면 적용 phase 또는 별도.
