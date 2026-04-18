# 개발된 페이지 목록

## 🏠 메인 페이지
- `/` - 홈페이지 (랜딩 페이지)

## 🔍 검색 및 제품
- `/search` - 일반 검색 페이지
- `/products/[id]` - 제품 상세 페이지
- `/compare` - 제품 비교 페이지
- `/compare/quote` - 견적 비교 페이지

## 🧪 테스트/체험 페이지
- `/test` - 테스트 메인 페이지
- `/test/search` - 검색/AI 분석 체험
- `/test/compare` - 제품 비교 체험
- `/test/quote` - 품목 리스트 체험
- `/test/quote/request` - 견적 요청 체험
- `/test/analysis` - 분석 페이지

## 📋 견적 관리
- `/quotes` - 견적 목록 페이지
- `/quotes/[id]` - 견적 상세 페이지

## 📊 대시보드
- `/dashboard` - 대시보드 메인
- `/dashboard/activity-logs` - 활동 로그
- `/dashboard/budget` - 예산 관리
- `/dashboard/inventory` - 재고 관리
- `/dashboard/organizations` - 조직 관리
- `/dashboard/shared-links` - 공유 링크 관리
- `/dashboard/safety` - 안전 관리
- `/dashboard/admin` - 관리자 페이지
- `/dashboard/supplier` - 공급업체 관리

## ⚙️ 설정
- `/dashboard/settings/enterprise` - 엔터프라이즈 설정 (SSO, 권한 관리, 감사 로그)
- `/dashboard/settings/plans` - 구독 플랜 설정

## 🏢 벤더 포털
- `/dashboard/vendor/quotes` - 벤더 견적 관리
- `/dashboard/vendor/premium` - 벤더 프리미엄 기능
- `/dashboard/vendor/billing` - 벤더 결제 관리

## 📈 리포트
- `/reports` - 구매 리포트

## 📄 프로토콜 분석
- `/protocol/bom` - 프로토콜 BOM 생성

## 🔗 공유
- `/share/[publicId]` - 공유 링크 페이지

## 🔐 인증
- `/auth/signin` - 로그인 페이지
- `/auth/error` - 인증 오류 페이지

## ℹ️ 정보 페이지
- `/about` - 소개 페이지
- `/help` - 도움말 페이지
- `/changelog` - 변경 이력 페이지
- `/terms` - 이용약관 페이지
- `/privacy` - 개인정보처리방침 페이지

## 📝 참고사항
- `[id]`는 동적 라우트 파라미터입니다 (예: `/products/123`)
- `[publicId]`는 공유 링크의 고유 ID입니다 (예: `/share/abc123`)



