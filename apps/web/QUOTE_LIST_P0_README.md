# 비로그인 임시저장 견적요청서 기능 (P0)

## 개요

`/test/quote` 플로우를 비로그인 사용자도 DB에 저장/불러오기 가능하게 만든 기능입니다.
로그인 없는 사용자는 `guestKey`(쿠키)로 소유권을 관리합니다.

## 구현 내용

### 1. Prisma Schema 변경사항

#### 새로운 모델 추가
- **QuoteList**: 견적요청서 헤더 모델
  - `guestKey`: String (필수, 쿠키로 발급)
  - `userId`: String? (nullable, 추후 로그인 연결)
  - `title`, `message`, `status`, `currency`, `totalAmount` 등

- **QuoteListItem**: 기존 모델 수정
  - `quoteId`: String? (기존 Quote 모델용)
  - `quoteListId`: String? (새로운 QuoteList 모델용)
  - `productId`: String? (nullable, 직접 입력 가능)
  - `name`, `vendor`, `brand`, `catalogNumber` 등 추가 필드

#### Enum 추가
- **QuoteListStatus**: `DRAFT`, `SENT`

### 2. API 라우트 구현

#### POST `/api/quote-lists`
- 견적요청서 리스트 생성
- 입력: `{ title?, message?, items: QuoteItemInput[] }`
- 동작: guestKey 확보 → QuoteList 생성 + items createMany
- 반환: `{ id }`

#### GET `/api/quote-lists/[id]`
- 견적요청서 리스트 조회
- 권한: guestKey 일치 OR userId 일치
- 반환: QuoteList + items (product 포함)

#### PUT `/api/quote-lists/[id]`
- 헤더 업데이트 (title, message, status)

#### PUT `/api/quote-lists/[id]/items`
- items 통째로 replace
- 동작: 기존 items deleteMany → 새로 createMany

### 3. 유틸리티 함수

#### `getOrCreateGuestKey()`
- 쿠키에서 guestKey 읽기 또는 생성
- 쿠키 이름: `bil_guest`
- 옵션: httpOnly=true, sameSite=lax, secure=prod, maxAge=30일

#### `handleApiError()`
- 표준 에러 처리
- ZodError, 일반 Error 등 처리

#### `validateJsonBody()`, `validateSearchParams()`
- Zod 스키마로 JSON body / search params 검증

#### `logger`
- 간단한 로깅 유틸리티
- info, warn, error, debug 레벨 지원

## 마이그레이션 실행

데이터베이스 연결이 되면 다음 명령어를 실행하세요:

```bash
cd apps/web
pnpm prisma migrate dev --name quote_list_p0
pnpm prisma generate
```

## 프론트엔드 연동

`/test/quote` 페이지는 이미 API를 호출하도록 구현되어 있습니다:
- 페이지 진입 시 `listId`가 있으면 GET으로 로드
- 없으면 POST로 생성 후 URL에 `?id=...` 추가
- 스토어에 hydrate하여 표시

## 운영 시 주의사항

1. **권한 검증**: guestKey가 다르면 다른 사람 리스트는 절대 조회/수정 불가
2. **쿠키 관리**: guestKey 쿠키는 30일 유지, httpOnly로 XSS 방지
3. **데이터 정리**: 오래된 guest 리스트 정리 스크립트 필요 (추후 구현)
4. **로그인 연결**: userId가 설정되면 guestKey와 함께 소유권 확인

## 다음 단계 (P1+)

- [ ] userId 로그인 연결 지원
- [ ] 오래된 guest 리스트 자동 정리
- [ ] 리스트 공유 기능 (기존 SharedList 모델 활용)
- [ ] 버전 관리 (기존 Quote 모델의 버전 관리 참고)









