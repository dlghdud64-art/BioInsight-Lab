# P0 개발 체크리스트 (데모/파일럿용)

## 0. P0 전체 우선순위 요약

### 1순위 (없으면 데모 자체가 안 됨)
1. ✅ 홈(랜딩)
2. ✅ 검색/비교 메인 화면
3. ✅ 품목 리스트(구매 요청 리스트) 화면
4. ✅ 견적/그룹웨어 붙여넣기 화면

### 2순위 (있으면 데모 퀄리티↑)
5. ✅ 프로토콜 텍스트 분석 (Mode B 기본 버전)
6. ✅ 공통 레이아웃/디자인 시스템 (Header/Footer/공용 UI)

### 3순위 (P1로 밀 수 있음)
7. ⏳ 구매내역/예산 대시보드
8. ⏳ 안전·규제 정보 상세 기능(실제 데이터 연동)

---

## 1. 공통 레이아웃 & 디자인 시스템

### 1-1. Layout / Shell
- [x] `<AppHeader>` (MainHeader)
  - [x] 좌측 로고(BioInsight Lab)
  - [x] 상단 네비게이션: 기능 소개, 사용 흐름, 누가 쓰나요?
  - [x] 데모 시작하기 버튼 (기능 체험 드롭다운)
- [x] `<AppFooter>` (MainFooter)
  - [x] 서비스 설명 한 줄
  - [x] Beta 안내
  - [x] 연락/피드백 채널
- [x] `<MainLayout>`
  - [x] max-w-6xl mx-auto px-4 md:px-6 lg:px-8 컨테이너
  - [x] 기본 배경색 (light gray), 섹션별 bg-white 카드 느낌

### 1-2. 공용 UI 컴포넌트 (shadcn 기반)
- [x] Button
- [x] Card / CardHeader / CardContent
- [x] Tabs / ToggleGroup (Step 전환용)
- [x] Badge / Chip (상태/카테고리)
- [x] Modal / Dialog (품목 리스트 미리보기, 삭제 확인 등)
- [x] Toast (에러/성공 메시지)
- [x] Loading Spinner / Skeleton

**상태**: ✅ 완료

---

## 2. 홈(랜딩) 화면

### 2-1. 섹션 구조
- [x] HeroSection
  - [x] 왼쪽: 큰 제목, 서브텍스트, CTA 버튼
  - [x] 오른쪽: 3단계 데모 플로우 패널 (HeroDemoFlowPanel)
- [x] 기능 소개 섹션 (FeaturesShowcaseSection)
- [x] 사용 흐름(Flow) 섹션 (FlowSection)
- [x] 페르소나(누가 쓰나요?) 섹션 (PersonaSection)
- [x] 요금/도입(향후) 섹션 (PricingSection)
- [x] Beta Banner (BetaBannerSection)
- [x] Comparison Section (ComparisonSection)
- [x] Safety Regulation Teaser (SafetyRegulationTeaserSection)

### 2-2. 체크리스트
- [x] HeroDemoFlowPanel 컴포넌트
- [x] FeatureSection (기능 카드)
- [x] FlowSection (3단계 설명)
- [x] PersonasSection (역할 카드)
- [x] 상단 네비와 섹션들 anchor 연동 (smooth scroll)

**상태**: ✅ 완료

---

## 3. 검색 / 비교 메인 화면 `/test/search`

### 3-1. 상단 Step Indicator
- [x] StepBar 컴포넌트 (StepNav)
- [x] Step 1: 검색/AI 분석
- [x] Step 2: 제품 비교
- [x] Step 3: 품목 리스트
- [x] 현재 페이지에 맞춰 Step 하이라이트

### 3-2. 왼쪽 컬럼: 검색 영역
- [x] SearchForm (SearchPanel)
  - [x] 검색어 인풋
  - [x] 카테고리/벤더 간단 필터
  - [x] 검색 버튼
  - [x] 샘플 검색어 버튼 (Human IL-6 ELISA kit, PCR Master Mix)
- [x] 검색 옵션 (옵션 패널)
  - [x] "검색 시 GPT 분석 함께 실행" 체크
  - [x] 결과 개수 제한, 정렬 방식
- [x] 프로토콜 텍스트 분석 진입 버튼 → /protocol/bom 링크

### 3-3. 중앙/우측: 검색 결과 & AI 분석
- [x] SearchResultList
- [x] ProductCard (반복)
  - [x] 제품명, 벤더, 카테고리, 가격, 짧은 설명
  - [x] "비교/리스트에 추가" 버튼
- [x] 결과 없음일 때: "검색 결과가 없습니다" + 샘플 검색어 제안
- [x] AIAnalysisPanel (SearchAnalysisCard)
  - [x] 검색 의도 요약
  - [x] 추천 카테고리/필터
  - [x] 관련 키워드
  - [x] 예시 결과 형식 placeholder

### 3-4. 품목 리스트 미리보기
- [x] SelectedItemsPanel (QuoteListPreviewCard)
- [x] 현재 선택된 제품 개수
- [x] 리스트(제품명/벤더/단위 정도)
- [x] 개별 삭제 버튼
- [x] "품목 리스트 단계로 이동" 버튼 → /test/quote

**상태**: ✅ 완료 (일부 개선 가능)

---

## 4. 구매 요청 리스트 화면 `/test/quote`

### 4-1. 상단
- [x] 페이지 제목: "구매 요청 품목 리스트"
- [x] 안내 문구
- [x] StepBar 연속 표시 (현재 Step 2 하이라이트)

### 4-2. 품목 테이블
- [x] QuoteItemTable (QuotePanel)
- [x] 컬럼:
  - [x] 체크박스 (일괄 삭제)
  - [x] 품목명 (풀네임, 잘리지 않게)
  - [x] 벤더
  - [x] 규격/단위
  - [x] 수량 (인라인 수정)
  - [x] 단가(옵션)
  - [x] 금액(=단가×수량, 자동 계산)
  - [x] 비고(인라인 수정)
- [x] 행 기능:
  - [x] 행 삭제 아이콘
  - [ ] "검색 결과에서 다시 보기" 링크 (옵션)

### 4-3. 합계 & 행동 버튼
- [x] SummaryBar
  - [x] 총 품목 수
  - [x] 총 금액
- [x] 주요 버튼:
  - [x] "견적/그룹웨어용 텍스트 만들기" → /test/quote/request
  - [x] "검색으로 돌아가기" → /test/search
  - [ ] CSV/엑셀로 임시 내보내기 (옵션)

### 4-4. 빈 상태 UI 개선 필요
- [ ] 항상 테이블 헤더 표시 (품목이 없을 때도)
- [ ] 빈 상태 플레이스홀더: "Select products from search results to add items here."
- [ ] 삭제/편집 버튼 플레이스홀더 아이콘

**상태**: ✅ 대부분 완료, 빈 상태 UI 개선 필요

---

## 5. 견적/그룹웨어 붙여넣기 화면 `/test/quote/request`

### 5-1. 상단
- [x] 페이지 제목: "견적/구매 요청 텍스트 생성"
- [x] StepBar (현재 Step 3 하이라이트)

### 5-2. 기본 정보 폼
- [x] RequestForm (QuoteRequestPanel)
  - [x] 요청 제목 (자동 추천)
  - [x] 요청 부서 (텍스트 or 셀렉트)
  - [x] 희망 납기일
  - [x] 요청 메모 (자유 텍스트)
  - [x] 납품 장소

### 5-3. 미리보기 & 복사 영역
- [x] GroupwareTextPreview
- [x] 탭: 텍스트(일반), TSV/표 형식
- [x] 생성/갱신 버튼: "텍스트 생성/업데이트"
- [x] 결과 영역: textarea 혹은 code 블럭
- [x] 전체 복사 버튼
- [x] 링크/공유 기능

**상태**: ✅ 완료

---

## 6. 프로토콜 분석 (Mode B 간단 버전) `/protocol/bom`

### 6-1. UI 최소 구성
- [x] 제목: "프로토콜에서 필요한 제품 찾기 (Beta)"
- [x] 안내 텍스트
- [x] 텍스트 입력 영역 (textarea)
- [x] 샘플 프로토콜 버튼
- [x] 분석 버튼: "프로토콜 분석하기"
- [x] 결과 영역
  - [x] 추출된 필드 (실험 유형, 타깃, 관련 키워드)
  - [x] "이 조건으로 검색하기" 버튼 → /test/search로 이동 + 검색어/필터 프리셋

**상태**: ✅ 완료

---

## 7. 공통 기능 체크리스트 (엔지니어링 관점)

### 7-1. API Layer
- [x] 검색 API (Mock or 실제 DB)
- [x] 품목 리스트 저장은 FE state(로컬)로 시작 → 나중에 서버/DB로 확장

### 7-2. 상태 관리
- [x] 검색 조건 / 검색 결과 / 선택된 품목들을 특정 전역 상태(Zustand 등)로 관리
- [x] /test/search → /test/quote → /test/quote/request 간에 유지

### 7-3. 에러/로딩 처리
- [x] 검색 중 로딩 스피너
- [x] API 에러 시 토스트 + 메시지
- [ ] 더 세밀한 에러 처리 개선 가능

### 7-4. 라우팅
- [x] / → /test/search 링크 잘 작동
- [x] StepBar에서 각 Step 클릭 시 해당 화면으로 이동

**상태**: ✅ 대부분 완료

---

## 8. 용어 정리 (Copy Refactoring)

### 8-1. "test" → "demo/feature experience" 변경
- [ ] "Test Environment" → "Feature Experience · Search → Compare → Item List"
- [ ] "Feature Test Board" → "Feature Experience Board (Sample Data)"
- [ ] "Experience Search/Compare/List Creation Flow"
- [ ] 내부 개발자/QA UI는 "(For development)", "(For internal testing)" 명시

**상태**: ⏳ 진행 필요

---

## 9. P0 실제 구현 순서 추천

1. ✅ 공통 레이아웃 + 버튼/카드 등 UI 베이스
2. ✅ 검색/비교 메인 화면 /test/search
3. ✅ 품목 리스트 /test/quote
4. ✅ 견적/그룹웨어 텍스트 /test/quote/request
5. ✅ 홈(랜딩) /
6. ✅ 프로토콜 분석 /protocol/bom (간단 버전)
7. ⏳ 디테일/에러 처리/문구 다듬기
8. ⏳ 용어 정리 (test → demo/feature experience)

---

## 10. 다음 단계 (P0 완료 후)

### 개선 사항
- [ ] 빈 상태 UI 개선 (품목 리스트)
- [ ] 용어 정리 (test → demo/feature experience)
- [ ] 에러 처리 세밀화
- [ ] CSV/엑셀 내보내기 (옵션)
- [ ] "검색 결과에서 다시 보기" 링크 (옵션)

### P1 기능
- [ ] 구매내역/예산 대시보드
- [ ] 안전·규제 정보 상세 기능(실제 데이터 연동)
- [ ] 사용자 인증/세션 관리
- [ ] 서버/DB로 품목 리스트 저장

---

## 현재 진행률

**P0 핵심 기능**: ✅ 95% 완료
- 공통 레이아웃: ✅ 100%
- 홈(랜딩): ✅ 100%
- 검색/비교: ✅ 100%
- 품목 리스트: ✅ 95% (빈 상태 UI 개선 필요)
- 견적/그룹웨어: ✅ 100%
- 프로토콜 분석: ✅ 100%

**개선 필요**: ⏳ 5%
- 빈 상태 UI 개선
- 용어 정리
- 세밀한 에러 처리

