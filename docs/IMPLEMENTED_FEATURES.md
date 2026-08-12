# 구현된 기능 및 페이지 목록

## 📋 목차
1. [공개 페이지](#공개-페이지)
2. [기능 체험 플로우](#기능-체험-플로우)
3. [대시보드](#대시보드)
4. [제품 관련](#제품-관련)
5. [프로토콜 분석](#프로토콜-분석)
6. [공유 및 협업](#공유-및-협업)
7. [API 엔드포인트](#api-엔드포인트)

---

## 공개 페이지

### 1. 홈페이지 (`/`)
**경로**: `apps/web/src/app/page.tsx`

**주요 기능**:
- Hero 섹션
- Beta 배너
- 핵심 가치 제안
- 경쟁사 비교
- 사용 흐름 소개
- 기능 쇼케이스
- 페르소나 섹션
- AI 기능 소개
- 안전·규제 정보 티저
- 보안 섹션
- 요금제
- 최종 CTA

**연결된 컴포넌트**:
- `_components/hero-section.tsx`
- `_components/beta-banner-section.tsx`
- `_components/key-value-section.tsx`
- `_components/comparison-section.tsx`
- `_components/flow-section.tsx`
- `_components/features-showcase-section.tsx`
- `_components/persona-section.tsx`
- `_components/ai-section.tsx`
- `_components/safety-regulation-teaser-section.tsx`
- `_components/security-section.tsx`
- `_components/pricing-section.tsx`
- `_components/final-cta-section.tsx`

---

## 기능 체험 플로우

### 2. 기능 체험 메인 (`/test`)
**경로**: `apps/web/src/app/test/page.tsx`
- `/test/search`로 리다이렉트

### 3. 제품 검색 (`/test/search`)
**경로**: `apps/web/src/app/test/search/page.tsx`

**주요 기능**:
- 제품 검색 (텍스트 입력)
- GPT 기반 검색어 분석
- 검색 결과 표시
- 검색 결과에서 비교/품목 리스트 추가
- 품목 리스트 미리보기
- 검색어 분석 결과 카드 (GPT)

**연결된 컴포넌트**:
- `test/_components/search-panel.tsx` - 검색 입력 및 옵션
- `test/_components/search-result-item.tsx` - 검색 결과 아이템
- `test/_components/search-analysis-card.tsx` - GPT 분석 결과
- `test/_components/quote-list-preview-card.tsx` - 품목 리스트 미리보기
- `test/_components/test-flow-provider.tsx` - 상태 관리

**연결된 API**:
- `GET /api/products/search` - 제품 검색
- `POST /api/search/intent` - 검색 의도 분석 (GPT)

### 4. 제품 비교 (`/test/compare`)
**경로**: `apps/web/src/app/test/compare/page.tsx`

**주요 기능**:
- 선택한 제품들을 테이블로 비교
- 제품 순서 이동 (위/아래 화살표)
- 정렬 기능 (가격, 용량, 벤더 등)
- 필터 기능 (카테고리, 벤더)
- 납기일 비교
  - 실제 납기일 표시
  - 평균 납기일 표시 (참고용)
  - 납기일 수동 입력/수정
- 납기 비교 차트 (Bar Chart)
- CSV 내보내기
- 가격 비교 차트
- 재고 상태 비교

**비교 필드**:
- 제품명
- 카탈로그 번호
- 브랜드
- 카테고리
- 규격/용량
- Grade
- 최저가
- 납기일
- 재고 상태
- 최소 주문량
- 공급사 수

**연결된 API**:
- `GET /api/products/compare` - 제품 비교 데이터

### 5. 품목 리스트 (`/test/quote`)
**경로**: `apps/web/src/app/test/quote/page.tsx`

**주요 기능**:
- 품목 리스트 테이블 표시
- 벤더별 자동 그룹화 (토글)
- 구매 완료 태그
- 품목 추가/삭제
- 수량/단가 수정
- 공유 패널
  - 공유 링크 생성 (만료일 설정 가능)
  - 링크 비활성화
  - TSV 다운로드
  - CSV 다운로드
  - TSV 클립보드 복사 (그룹웨어 붙여넣기용)

**연결된 컴포넌트**:
- `test/_components/quote-panel.tsx` - 품목 리스트 및 공유 패널

**연결된 API**:
- `POST /api/shared-lists` - 공유 링크 생성
- `PATCH /api/shared-lists/[publicId]` - 링크 비활성화

---

## 대시보드

### 6. 대시보드 메인 (`/dashboard`)
**경로**: `apps/web/src/app/dashboard/page.tsx`

**주요 기능**:
- 최근 활동 요약
- 빠른 액션 링크
- 통계 카드

### 7. 예산 관리 (`/dashboard/budget`)
**경로**: `apps/web/src/app/dashboard/budget/page.tsx`

**주요 기능**:
- 예산 목록 조회
- 예산 추가/수정/삭제
- 예산 사용률 추적
- 예산 기간 설정
- 프로젝트/과제명 연결
- 예산 초과 경고

**연결된 API**:
- `GET /api/budgets` - 예산 목록 조회
- `POST /api/budgets` - 예산 생성
- `PATCH /api/budgets/[id]` - 예산 수정
- `DELETE /api/budgets/[id]` - 예산 삭제

### 8. 구매 리포트 (`/reports`)
**경로**: `apps/web/src/app/reports/page.tsx`

**주요 기능**:
- 구매 내역 필터링 (기간, 카테고리, 팀, 벤더, 예산)
- KPI 카드 (총 구매 금액, 건수, 평균 단가, 벤더 수)
- 예산 사용률 표시
- 예상 vs 실제 비교 차트
- 기간별 구매 추이 차트
- 예산별 사용률 파이 차트
- 상세 구매 내역 테이블
- CSV Import 기능

**연결된 API**:
- `GET /api/reports/purchase` - 구매 리포트 데이터
- `POST /api/purchases/import` - CSV Import

### 9. 조직 관리 (`/dashboard/organizations`)
**경로**: `apps/web/src/app/dashboard/organizations/page.tsx`

**주요 기능**:
- 조직 생성
- 조직 목록 조회
- 멤버 초대
- 멤버 역할 관리 (ADMIN, APPROVER, VIEWER)
- 멤버 제거

**연결된 API**:
- `GET /api/organizations` - 조직 목록
- `POST /api/organizations` - 조직 생성
- `POST /api/organizations/[id]/members` - 멤버 초대
- `PATCH /api/organizations/[id]/members` - 역할 변경
- `DELETE /api/organizations/[id]/members` - 멤버 제거

### 10. 공유 링크 관리 (`/dashboard/shared-links`)
**경로**: `apps/web/src/app/dashboard/shared-links/page.tsx`

**주요 기능**:
- 생성한 공유 링크 목록 조회
- 링크 만료일 확인
- 링크 비활성화

### 11. 인벤토리 관리 (`/dashboard/inventory`)
**경로**: `apps/web/src/app/dashboard/inventory/page.tsx`

**주요 기능**:
- 재고 목록 조회
- 재고 수량 관리
- 자동 재주문 추천

**연결된 API**:
- `GET /api/inventory` - 재고 목록
- `GET /api/inventory/reorder-recommendations` - 재주문 추천

### 12. 설정 - 요금제 (`/dashboard/settings/plans`)
**경로**: `apps/web/src/app/dashboard/settings/plans/page.tsx`

**주요 기능**:
- 현재 구독 플랜 확인
- 플랜 변경

---

## 제품 관련

### 13. 제품 상세 (`/products/[id]`)
**경로**: `apps/web/src/app/products/[id]/page.tsx`

**주요 기능**:
- 제품 기본 정보 표시
- 벤더별 가격 정보
- 스펙 정보
- 데이터시트 링크
- **안전·규제 정보 섹션** (P1)
  - MSDS/SDS 링크
  - 식약처 링크
  - 식약처 안전정보포털 링크
  - 환경부 화학물질안전원 링크
  - 안전 취급 요약/주의사항
- 추천 제품
- 리뷰

**연결된 API**:
- `GET /api/products/[id]` - 제품 상세 정보
- `GET /api/products/[id]/reviews` - 리뷰 목록

### 14. 제품 검색 (일반) (`/search`)
**경로**: `apps/web/src/app/search/page.tsx`

**주요 기능**:
- 제품 검색
- 검색 결과 표시
- 품목 리스트 추가 (기능 체험 플로우로 안내)

---

## 프로토콜 분석

### 15. 프로토콜 → BOM 생성 (`/protocol/bom`)
**경로**: `apps/web/src/app/protocol/bom/page.tsx`

**주요 기능**:
- **PDF 업로드** (탭)
  - 드래그 앤 드롭
  - 파일 선택
  - 파일 크기 제한 (10MB)
- **텍스트 붙여넣기** (탭)
  - 프로토콜 텍스트 입력
- GPT 기반 시약 추출
- 추출 결과 표시
  - 실험 유형
  - 샘플 타입
  - 프로토콜 요약
  - 추출된 시약 목록
  - 카테고리별 그룹화
  - 제품 매칭 상태
- **추출된 시약으로 제품 검색하기** 버튼
  - 검색 페이지로 이동
  - 추출된 시약명을 검색어로 자동 설정
  - 실험 유형에 따른 카테고리 필터 자동 적용
- BOM 생성
- 품목 리스트로 변환

**연결된 API**:
- `POST /api/protocol/extract` - PDF 파일 분석
- `POST /api/protocol/extract-text` - 텍스트 분석
- `POST /api/protocol/bom` - BOM 생성

**연결된 컴포넌트**:
- `protocol/bom/_components/protocol-upload.tsx` (있다면)

---

## 공유 및 협업

### 16. 공유 링크 조회 (`/share/[publicId]`)
**경로**: `apps/web/src/app/share/[publicId]/page.tsx`

**주요 기능**:
- 공유 링크로 품목 리스트 조회
- 만료일 확인
- 비활성화 상태 확인
- 조회 수 표시
- 비교 정보 요약
- 품목 리스트 표시
- 대체 후보 정보 표시

**연결된 컴포넌트**:
- `share/[publicId]/_components/shared-list-view.tsx`

**연결된 API**:
- `GET /api/shared-lists/[publicId]` - 공유 리스트 조회

---

## 인증

### 17. 로그인 (`/auth/signin`)
**경로**: `apps/web/src/app/auth/signin/page.tsx`

**주요 기능**:
- 이메일/비밀번호 로그인
- 소셜 로그인 (구현 여부 확인 필요)

**연결된 API**:
- `POST /api/auth/[...nextauth]` - NextAuth 인증

---

## 주요 플로우

### 플로우 1: 검색 → 비교 → 품목 리스트 → 공유
1. `/test/search` - 제품 검색
2. 검색 결과에서 "비교에 추가" 클릭
3. `/test/compare` - 제품 비교
4. 비교 테이블에서 "품목 리스트에 추가" 클릭
5. `/test/quote` - 품목 리스트 확인 및 공유 링크 생성

### 플로우 2: 프로토콜 분석 → 검색 → 비교
1. `/protocol/bom` - 프로토콜 PDF/텍스트 입력
2. 시약 추출 실행
3. "추출된 시약으로 제품 검색하기" 버튼 클릭
4. `/test/search` - 자동으로 검색어 설정됨
5. 검색 결과 확인 및 비교/품목 리스트 추가

### 플로우 3: 예산 관리 → 구매 리포트
1. `/dashboard/budget` - 예산 생성
2. `/reports` - 구매 내역 Import 및 리포트 확인
3. 예산 사용률 추적

---

## API 엔드포인트

### 제품 관련
- `GET /api/products/search` - 제품 검색
- `GET /api/products/[id]` - 제품 상세
- `GET /api/products/compare` - 제품 비교
- `GET /api/products/brands` - 브랜드 목록
- `POST /api/products/[id]/embedding` - 임베딩 생성
- `POST /api/products/[id]/view` - 조회 기록

### 검색 및 분석
- `POST /api/search/intent` - 검색 의도 분석 (GPT)
- `GET /api/search` - 검색 (레거시?)

### 프로토콜 분석
- `POST /api/protocol/extract` - PDF 파일 분석
- `POST /api/protocol/extract-text` - 텍스트 분석
- `POST /api/protocol/bom` - BOM 생성

### 공유
- `POST /api/shared-lists` - 공유 링크 생성
- `GET /api/shared-lists/[publicId]` - 공유 리스트 조회
- `PATCH /api/shared-lists/[publicId]` - 링크 비활성화

### 예산 및 리포트
- `GET /api/budgets` - 예산 목록
- `POST /api/budgets` - 예산 생성
- `PATCH /api/budgets/[id]` - 예산 수정
- `DELETE /api/budgets/[id]` - 예산 삭제
- `GET /api/reports/purchase` - 구매 리포트
- `POST /api/purchases/import` - CSV Import

### 조직
- `GET /api/organizations` - 조직 목록
- `POST /api/organizations` - 조직 생성
- `POST /api/organizations/[id]/members` - 멤버 초대
- `PATCH /api/organizations/[id]/members` - 역할 변경
- `DELETE /api/organizations/[id]/members` - 멤버 제거

### 인증
- `POST /api/auth/[...nextauth]` - NextAuth 인증

### 설정
- `GET /api/config` - 클라이언트 설정 (PDF 업로드 활성화 여부 등)

---

## 데이터베이스 모델 (주요)

### Product
- 기본 정보 (이름, 설명, 카테고리, 브랜드 등)
- 스펙 정보 (JSON)
- 안전·규제 정보 (msdsUrl, safetyNote)
- 벤더 정보 (ProductVendor)

### Quote / QuoteListItem
- 견적 리스트
- 품목 정보 (제품, 벤더, 수량, 단가 등)
- 구매 완료 태그 (isPurchased)

### SharedList
- 공유 링크
- 만료일 (expiresAt)
- 비활성화 여부 (isActive)
- 조회 수 (viewCount)

### Budget
- 예산 정보
- 기간 (periodStart, periodEnd)
- 프로젝트/과제명

### Organization / OrganizationMember
- 조직 정보
- 멤버 및 역할 관리

### PurchaseRecord
- 구매 내역
- 예산 연결

---

## 주요 개선 사항 (최근)

### ✅ 완료된 개선
1. **납기 비교 개선**
   - 평균 납기일 표시
   - 납기일 수동 입력/수정
   - 납기 비교 차트에 평균 납기일 포함

2. **프로토콜 분석 통합**
   - 추출된 시약으로 제품 검색 버튼 추가
   - 검색 필터 자동 적용

3. **품목 리스트 UX 개선**
   - 벤더별 그룹화
   - 구매 완료 태그
   - TSV 클립보드 복사

4. **공유 링크 개선**
   - 만료일 설정
   - 링크 비활성화 기능

5. **비교 테이블 개선**
   - 제품 순서 이동
   - 정렬/필터 강화
   - CSV 내보내기

---

## 미구현 기능 (참고)

### P1+
- 액티비티 로그

### P2
- 제품 안전 필드 구조화
- 프로토콜 분석 고도화 (실험 조건 파싱)
- 추천 기능 고도화
- Enterprise 기능 (SSO, 감사 로그 등)

---

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand, React Context
- **Data Fetching**: TanStack Query
- **Charts**: recharts
- **Database**: PostgreSQL + Prisma
- **Language**: TypeScript
- **PDF Parsing**: pdf-parse

---

*최종 업데이트: 2024-12-11*

