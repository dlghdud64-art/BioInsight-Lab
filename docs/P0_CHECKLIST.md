# P0 기능 개발 점검 리스트

## PRD 기반 P0 (MVP) 기능 점검 결과

### ✅ 4.1 검색 (Search) - 완료
- [x] 한 줄 검색창 구현 (`/search`, `SearchInput` 컴포넌트)
- [x] GPT 기반 검색 의도 분석 (`/api/search/intent`)
- [x] 필터 기능 (카테고리, 벤더, 가격 범위)
- [x] 검색 결과 API (`/api/products/search`)

**구현 위치:**
- `apps/web/src/app/search/page.tsx`
- `apps/web/src/components/SearchInput.tsx`
- `apps/web/src/app/api/search/intent/route.ts`
- `apps/web/src/app/api/products/search/route.ts`

### ✅ 4.2 검색 결과 리스트 & 제품 상세 - 완료
- [x] 검색 결과 리스트 표시 (제품명, 벤더, 카테고리, 가격, 설명)
- [x] "비교에 추가" 버튼
- [x] "구매 리스트에 담기" 버튼
- [x] 제품 상세 페이지 (`/products/[id]`)

**구현 위치:**
- `apps/web/src/app/search/SearchResultList.tsx`
- `apps/web/src/app/products/[id]/page.tsx`
- `apps/web/src/app/test/_components/search-result-item.tsx`

### ✅ 4.3 제품 비교 (Compare) - 완료
- [x] 비교 테이블 구현 (`/compare`)
- [x] 제품명, 벤더, 규격/용량, 가격, 카탈로그 번호, 주요 스펙 표시
- [x] 행별 삭제 기능
- [x] "구매 리스트에 추가" 기능
- [x] 정렬/필터 기능 (가격, 용량 등)
- [x] 벤더 기준 필터

**구현 위치:**
- `apps/web/src/app/compare/page.tsx`
- `apps/web/src/lib/store/compare-store.ts`

### ✅ 4.4 구매 요청 리스트 / 견적 준비 - 완료
- [x] 구매 요청 리스트 (품목 리스트) 구현
- [x] 컬럼: No, 제품명, 벤더, 규격/단위, 수량, 단가, 금액, 비고
- [x] 품목 추가/삭제 기능
- [x] 수량/비고 편집 기능
- [x] 전체/선택 행 삭제 기능
- [x] 총액 자동 합산
- [x] TSV 텍스트 복사 기능
- [x] CSV/엑셀 다운로드 기능
- [x] 링크 공유 기능 (P1이지만 구현됨)

**구현 위치:**
- `apps/web/src/app/test/_components/quote-panel.tsx`
- `apps/web/src/app/test/_components/share-actions-card.tsx`
- `apps/web/src/app/compare/quote/page.tsx`

### ✅ 4.5 프로토콜 텍스트 분석 (Mode B - P0) - 완료
- [x] 텍스트 붙여넣기 입력 UI
- [x] GPT 기반 프로토콜 분석 (`/api/protocol/extract-text`)
- [x] 실험 유형, 타깃, 농도/부피, 사용 장비 유형 추출
- [x] 추출된 필드를 기반으로 검색 필터 자동 설정
- [x] 관련 제품 리스트/비교 테이블 생성

**구현 위치:**
- `apps/web/src/components/protocol/protocol-upload.tsx`
- `apps/web/src/app/api/protocol/extract-text/route.ts`
- `apps/web/src/app/test/_components/analysis-panel.tsx`

### ✅ 4.6 UX – 홈/데모 플로우 - 완료
- [x] 홈 페이지 구성
- [x] 서비스 한 줄 요약
- [x] 주요 CTA ("검색/비교 시작하기")
- [x] 3단계 데모 플로우 패널 (Step 1: 검색, Step 2: 비교·리스트, Step 3: 그룹웨어에 붙여넣기)
- [x] "누가 쓰나요?" 페르소나 카드 섹션
- [x] Next.js App Router + shadcn + Tailwind 기반 기본 스타일

**구현 위치:**
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/_components/hero-section.tsx`
- `apps/web/src/app/_components/demo-flow-switcher.tsx`
- `apps/web/src/app/test/` (테스트 플로우)

## 개선 필요 사항

### 1. 검색 기능 (4.1)
- [ ] GPT 기반 오타/동의어 보정 강화
- [ ] 검색 결과 페이지네이션/무한 스크롤 개선
- [ ] 가격 범위 필터 UI 개선

### 2. 제품 비교 (4.3)
- [ ] 순서 이동 기능 추가 (드래그 앤 드롭)
- [ ] 비교 테이블 가상 스크롤 적용 (대량 제품 비교 시)

### 3. 구매 요청 리스트 (4.4)
- [ ] 그룹웨어 양식 템플릿 저장/불러오기 기능 (P1이지만 고려)
- [ ] 복사한 TSV 형식 검증 기능

### 4. 프로토콜 분석 (4.5)
- [ ] 추출된 필드의 정확도 개선
- [ ] 실험 회차에 따른 수량 자동 계산 개선

### 5. 홈/데모 플로우 (4.6)
- [ ] 데모 플로우 인터랙티브 개선
- [ ] 페르소나 섹션 콘텐츠 보강

## 다음 단계 (P1)

1. 구매 내역/예산 대시보드
2. 제품 상세의 안전·규제 정보 섹션
3. 조직/팀 관리 기본 구조
4. 공유 링크/리스트 저장/불러오기 고도화

## 기술 스택 확인

- ✅ Next.js 14 (App Router)
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ shadcn/ui
- ✅ TanStack Query (React Query)
- ✅ Zustand (상태 관리)
- ✅ Prisma + PostgreSQL
- ✅ NextAuth (인증)

