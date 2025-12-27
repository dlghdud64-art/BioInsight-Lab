# Quote Share Feature Documentation

## Overview
공개 공유 링크 기능을 통해 견적서를 외부에 읽기 전용으로 공유할 수 있습니다.

## Features

### 1. 공유 링크 생성 및 관리
- **안전한 토큰 생성**: UUID v4 + 24바이트 추가 엔트로피 (총 85자)
- **만료 기능**: 1~365일 사이 설정 가능
- **활성화/비활성화**: 토큰 삭제 없이 soft disable
- **업데이트 가능**: 기존 공유 링크 설정 변경 가능

### 2. 보안
- **Rate Limiting**: 분당 60 요청 제한 (IP 기반)
- **SEO 차단**: robots noindex 설정
- **만료 검증**: 서버 사이드에서 만료 시간 체크
- **읽기 전용**: 공유 링크로는 수정 불가

### 3. 내보내기
- **TSV 형식**: 탭으로 구분된 값
- **CSV 형식**: RFC 4180 표준 준수
- **자동 파일명**: quote-{title}-{timestamp}.{ext}
- **전체 데이터**: 헤더 정보 + 아이템 테이블

---

## API Endpoints

### POST /api/quotes/:id/share

**설명**: 견적서 공유 링크 생성 또는 업데이트

**권한**: 견적서 소유자 또는 guestKey 일치

**요청**:
```json
{
  "enabled": true,
  "expiresInDays": 7  // Optional, 1-365
}
```

**응답**:
```json
{
  "shareToken": "550e8400-e29b-41d4-a716-446655440000-1234567890abcdef1234567890abcdef1234567890abcdef",
  "enabled": true,
  "expiresAt": "2025-01-03T00:00:00.000Z",
  "shareUrl": "https://example.com/share/550e8400-e29b-41d4-a716-446655440000-1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**상태 코드**:
- `201`: 새 공유 링크 생성됨
- `200`: 기존 공유 링크 업데이트됨
- `400`: 잘못된 요청 (expiresInDays 범위 초과 등)
- `403`: 권한 없음
- `404`: 견적서를 찾을 수 없음

---

### GET /api/quotes/:id/share

**설명**: 견적서의 공유 링크 정보 조회

**권한**: 견적서 소유자 또는 guestKey 일치

**응답**:
```json
{
  "share": {
    "shareToken": "...",
    "enabled": true,
    "expiresAt": "2025-01-03T00:00:00.000Z",
    "shareUrl": "https://example.com/share/...",
    "createdAt": "2024-12-27T00:00:00.000Z",
    "updatedAt": "2024-12-27T00:00:00.000Z"
  }
}
```

**share가 null인 경우**: 공유 링크가 아직 생성되지 않음

---

### DELETE /api/quotes/:id/share

**설명**: 공유 링크 비활성화 (soft delete)

**권한**: 견적서 소유자 또는 guestKey 일치

**응답**:
```json
{
  "success": true
}
```

**참고**: 실제로 삭제하지 않고 `enabled: false`로 설정

---

### GET /api/share/:token

**설명**: 공유 토큰으로 견적서 조회 (공개 엔드포인트)

**Rate Limit**: 분당 60 요청 (IP 기반)

**응답 헤더**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2024-12-27T00:01:00.000Z
```

**응답**:
```json
{
  "quote": {
    "id": "...",
    "title": "연구용 시약 견적",
    "description": "...",
    "status": "PENDING",
    "currency": "KRW",
    "totalAmount": 1000000,
    "items": [
      {
        "id": "...",
        "lineNumber": 1,
        "name": "DMSO",
        "brand": "Sigma",
        "catalogNumber": "D2650",
        "unit": "mL",
        "quantity": 100,
        "unitPrice": 10000,
        "lineTotal": 1000000,
        "currency": "KRW",
        "notes": "High purity"
      }
    ],
    "vendors": [],
    "createdAt": "2024-12-27T00:00:00.000Z",
    "updatedAt": "2024-12-27T00:00:00.000Z"
  },
  "share": {
    "expiresAt": "2025-01-03T00:00:00.000Z",
    "createdAt": "2024-12-27T00:00:00.000Z"
  }
}
```

**상태 코드**:
- `200`: 성공
- `400`: 잘못된 토큰 형식
- `404`: 공유 링크를 찾을 수 없음 / 비활성화됨 / 만료됨
- `429`: Rate limit 초과

---

## Frontend Integration

### 공유 링크 생성 예제

```typescript
import { createQuoteShare, getQuoteShare, deleteQuoteShare } from '@/lib/api/quotes-client';
import { useToast } from '@/hooks/use-toast';

function ShareButton({ quoteId }: { quoteId: string }) {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleCreateShare = async () => {
    try {
      const share = await createQuoteShare(quoteId, {
        enabled: true,
        expiresInDays: 7, // 7일 후 만료
      });

      setShareUrl(share.shareUrl);

      toast({
        title: "공유 링크 생성 완료",
        description: "링크가 클립보드에 복사되었습니다.",
      });

      // Copy to clipboard
      navigator.clipboard.writeText(share.shareUrl);
    } catch (error) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDisableShare = async () => {
    try {
      await deleteQuoteShare(quoteId);
      setShareUrl(null);

      toast({
        title: "공유 링크 비활성화됨",
      });
    } catch (error) {
      toast({
        title: "오류",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      {shareUrl ? (
        <div>
          <input value={shareUrl} readOnly />
          <Button onClick={handleDisableShare}>비활성화</Button>
        </div>
      ) : (
        <Button onClick={handleCreateShare}>공유 링크 생성</Button>
      )}
    </div>
  );
}
```

### TSV/CSV 내보내기 예제

```typescript
import { exportQuoteAsTSV, exportQuoteAsCSV } from '@/lib/export/quote-export';

function ExportButtons({ quote }) {
  return (
    <div>
      <Button onClick={() => exportQuoteAsTSV(quote)}>
        TSV로 내보내기
      </Button>
      <Button onClick={() => exportQuoteAsCSV(quote)}>
        CSV로 내보내기
      </Button>
    </div>
  );
}
```

---

## Share Token Format

### 구조
```
{UUID v4}-{48 hex chars}
```

### 예시
```
550e8400-e29b-41d4-a716-446655440000-1234567890abcdef1234567890abcdef1234567890abcdef
```

### 특징
- **길이**: 총 85자 (UUID 36 + separator 1 + entropy 48)
- **엔트로피**: 192비트 (UUID 122비트 + 추가 192비트)
- **추측 불가능**: 2^314 조합
- **URL 안전**: 하이픈과 영숫자만 사용

---

## Rate Limiting

### 구현
- **방식**: In-memory Map (간단한 구현)
- **제한**: 분당 60 요청
- **식별자**: Client IP (x-forwarded-for, x-real-ip, cf-connecting-ip)
- **응답 헤더**: X-RateLimit-* 헤더 포함

### 프로덕션 고려사항
- Redis 사용 권장 (멀티 서버 환경)
- IP 외 추가 식별자 고려 (User-Agent, 쿠키 등)
- 더 정교한 Rate Limiting 알고리즘 (Sliding Window, Token Bucket)

---

## SEO & Robots

### robots meta tag
```html
<meta name="robots" content="noindex, nofollow, nocache" />
```

### layout.tsx 설정
```typescript
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
```

---

## Export Formats

### TSV (Tab-Separated Values)

**장점**:
- Excel에서 직접 열기 쉬움
- 데이터에 콤마가 많을 때 유리
- 간단한 파싱

**예시**:
```
Quote Title:	연구용 시약 견적
Status:	PENDING
Currency:	KRW
Total Amount:	1000000

Line No.	Product Name	Brand	Catalog No.	Unit	Quantity	Unit Price	Line Total	Notes
1	DMSO	Sigma	D2650	mL	100	10000	1000000	High purity
```

### CSV (Comma-Separated Values)

**장점**:
- 표준 포맷 (RFC 4180)
- 대부분의 도구에서 지원
- 프로그래밍 언어에서 쉽게 파싱

**예시**:
```csv
Quote Title,연구용 시약 견적
Status,PENDING
Currency,KRW
Total Amount,1000000

Line No.,Product Name,Brand,Catalog No.,Unit,Quantity,Unit Price,Line Total,Notes
1,DMSO,Sigma,D2650,mL,100,10000,1000000,High purity
```

**특수 문자 처리**:
- 콤마, 따옴표, 개행 포함 시 자동으로 큰따옴표로 감쌈
- 큰따옴표는 `""` 로 이스케이프

---

## File Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── quotes/
│   │   │   │   └── [id]/
│   │   │   │       └── share/
│   │   │   │           └── route.ts  # POST, GET, DELETE /api/quotes/:id/share
│   │   │   └── share/
│   │   │       └── [token]/
│   │   │           └── route.ts      # GET /api/share/:token
│   │   └── share/
│   │       └── [token]/
│   │           ├── page.tsx          # Share page UI
│   │           └── layout.tsx        # SEO noindex
│   └── lib/
│       ├── api/
│       │   ├── quotes-client.ts      # Share API functions (updated)
│       │   ├── share-token.ts        # Token generation
│       │   └── rate-limit.ts         # Rate limiting
│       └── export/
│           └── quote-export.ts       # TSV/CSV export
```

---

## Security Checklist

- [x] **안전한 토큰 생성**: UUID v4 + 추가 엔트로피
- [x] **만료 검증**: 서버 사이드 체크
- [x] **활성화 검증**: enabled 플래그 체크
- [x] **Rate Limiting**: IP 기반 분당 60 요청
- [x] **SEO 차단**: robots noindex
- [x] **읽기 전용**: 공유 링크로 수정 불가
- [x] **권한 검증**: 소유자만 공유 링크 생성/삭제
- [x] **Soft Delete**: 비활성화 시 데이터 보존

---

## Testing

### 공유 링크 생성 테스트
```bash
# 1. 견적서 생성
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Quote",
    "items": [{"name": "Item 1", "quantity": 1}]
  }'

# 2. 공유 링크 생성
curl -X POST http://localhost:3000/api/quotes/{quoteId}/share \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "expiresInDays": 7}'

# 3. 공유 링크 접속
curl http://localhost:3000/api/share/{shareToken}
```

### Rate Limiting 테스트
```bash
# 61번 요청 (마지막 요청은 429 반환해야 함)
for i in {1..61}; do
  curl -w "%{http_code}\n" http://localhost:3000/api/share/{token}
done
```

---

## Troubleshooting

### 공유 링크가 404를 반환
- 토큰 형식 확인 (85자, UUID-hex48)
- enabled 상태 확인 (DB에서 직접 확인)
- 만료 시간 확인

### Rate Limit이 작동하지 않음
- 서버 재시작 (in-memory cache 초기화)
- IP 헤더 확인 (프록시 환경에서 x-forwarded-for 설정)

### TSV/CSV 파일이 깨짐
- 인코딩 확인 (UTF-8)
- Excel에서 "데이터 > 텍스트 파일 가져오기" 사용
- 특수 문자 이스케이프 확인

---

## Future Enhancements

### Phase 2
- [ ] **Password Protection**: 공유 링크에 비밀번호 추가
- [ ] **View Analytics**: 조회 수, 조회 시간, IP 로그
- [ ] **Custom Branding**: 공유 페이지 브랜딩
- [ ] **Email Sharing**: 공유 링크 이메일 발송

### Performance
- [ ] **Redis Rate Limiting**: 멀티 서버 환경 지원
- [ ] **CDN Caching**: 공유 페이지 CDN 캐싱
- [ ] **API Response Caching**: quote 데이터 캐싱 (짧은 TTL)

### Export
- [ ] **Excel Format (.xlsx)**: 네이티브 Excel 파일 생성
- [ ] **PDF Export**: 견적서 PDF 다운로드
- [ ] **Custom Templates**: 내보내기 템플릿 커스터마이징

---

**구현 완료일**: 2025-12-27
**버전**: 1.0.0
