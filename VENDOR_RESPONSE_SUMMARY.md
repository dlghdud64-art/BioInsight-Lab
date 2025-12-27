# 견적 회신 기능 - Quick Start

## 🎯 기능 요약

**내부 사용자** → 벤더에게 견적 요청 전송 → 이메일 발송
**벤더** → 이메일 링크 클릭 → 로그인 없이 견적 회신 제출
**내부 사용자** → 여러 벤더 회신 비교 → 구매 결정

---

## 📦 구현 완료 사항

### API (100% 완료)
✅ POST /api/quotes/:id/vendor-requests - 벤더 요청 생성 + 이메일 발송
✅ GET /api/quotes/:id/vendor-requests - 요청 목록 조회
✅ GET /api/vendor-requests/:token - 공개 조회 (벤더용)
✅ POST /api/vendor-requests/:token/response - 회신 제출 (벤더용)

### 데이터베이스 (100% 완료)
✅ QuoteVendorRequest 모델
✅ QuoteVendorResponseItem 모델
✅ 마이그레이션 파일

### 기타 (100% 완료)
✅ 토큰 생성 (48자, 추측 불가)
✅ SendGrid 이메일 템플릿
✅ Rate limiting (60/10 req/min)
✅ 검증 로직 (만료, 중복 제출 방지)

### UI (구현 필요)
⏸️ /test/quote에 "견적 요청 보내기" 버튼
⏸️ /vendor/[token] 페이지
⏸️ 회신 비교 UI

---

## 🚀 사용 방법

### 1. 환경 설정
```env
# .env 파일에 추가
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. 마이그레이션
```bash
cd apps/web
npm run db:migrate
npm run db:generate
```

### 3. API 테스트

**벤더 요청 전송**
```bash
curl -X POST http://localhost:3000/api/quotes/{quoteId}/vendor-requests \
  -H "Content-Type: application/json" \
  -d '{
    "vendors": [
      {"email": "vendor@example.com", "name": "Vendor A"}
    ],
    "message": "견적 부탁드립니다",
    "expiresInDays": 14
  }'
```

**벤더 조회 (공개)**
```bash
curl http://localhost:3000/api/vendor-requests/{token}
```

**회신 제출 (공개)**
```bash
curl -X POST http://localhost:3000/api/vendor-requests/{token}/response \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "quoteItemId": "item_xxx",
        "unitPrice": 10000,
        "leadTimeDays": 7
      }
    ]
  }'
```

---

## 📁 주요 파일

### API
- `src/app/api/quotes/[id]/vendor-requests/route.ts`
- `src/app/api/vendor-requests/[token]/route.ts`
- `src/app/api/vendor-requests/[token]/response/route.ts`

### Library
- `src/lib/api/vendor-request-token.ts`
- `src/lib/email/vendor-request-templates.ts`

### Database
- `prisma/schema.prisma`
- `prisma/migrations/20251227_add_vendor_request_response/`

### Documentation
- `VENDOR_RESPONSE_FEATURE.md` - 전체 문서
- `VENDOR_RESPONSE_SUMMARY.md` - 이 파일

---

## 🔒 보안

- ✅ 48자 랜덤 토큰 (crypto.randomBytes)
- ✅ Rate limiting (IP 기반)
- ✅ 만료 시간 검증
- ✅ 중복 제출 방지 (RESPONDED 후 차단)
- ✅ 공개 API에서 민감정보 제외

---

## 🎨 UI 구현 가이드

**전체 UI 예제 코드**: `VENDOR_RESPONSE_FEATURE.md` 참조

### 필수 컴포넌트
1. **VendorRequestModal** - 견적 요청 전송 모달
2. **/vendor/[token]** - 벤더 회신 페이지
3. **VendorResponsesComparison** - 회신 비교 테이블

### 디자인 가이드
- ❌ RFQ 용어 사용 금지
- ✅ "견적 요청", "견적 회신" 사용
- 📏 업무툴 스타일 (compact, border)
- 📊 밀도 높은 테이블 (비교 화면)

---

## ✅ 테스트 체크리스트

```bash
# 1. 마이그레이션
npm run db:migrate ✓

# 2. API 테스트
curl POST /api/quotes/{id}/vendor-requests ✓
curl GET /api/vendor-requests/{token} ✓
curl POST /api/vendor-requests/{token}/response ✓

# 3. 이메일 확인
SendGrid에서 이메일 발송 확인 ⏸

# 4. 만료 테스트
expiresInDays: 0으로 테스트 → 410 에러 ⏸

# 5. 중복 제출 테스트
2번 제출 → 409 에러 ⏸
```

---

## 📈 다음 단계

### UI 구현
1. /test/quote에 "견적 요청 보내기" 버튼 추가
2. VendorRequestModal 컴포넌트 생성
3. /vendor/[token] 페이지 생성
4. 회신 비교 UI 추가

### 향후 개선
- [ ] 벤더 회신 알림 (내부 사용자에게)
- [ ] 회신 수정 기능 (1회 허용)
- [ ] CSV 내보내기
- [ ] 벤더 자동 완성 (기존 벤더 DB)
- [ ] 이메일 재발송 기능

---

**구현 완료**: 2025-12-27
**상태**: ✅ API 완료, ⏸️ UI 구현 필요
**문서**: VENDOR_RESPONSE_FEATURE.md
