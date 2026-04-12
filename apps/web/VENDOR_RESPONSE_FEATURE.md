# 견적 회신(벤더 응답) 기능 - 구현 완료 문서

## 🎯 목표
내부 사용자가 견적 요청서를 벤더에게 전송하고, 벤더가 로그인 없이 링크로 접속하여 견적 회신을 제출하는 MVP 기능 구현

## ✅ 구현 완료 사항

### 1. 데이터베이스 스키마 (Prisma)

#### 새로운 Enum
```prisma
enum VendorRequestStatus {
  SENT       // 발송 완료
  RESPONDED  // 벤더 회신 완료
  EXPIRED    // 만료됨
  CANCELLED  // 취소됨
}
```

#### 새로운 모델

**QuoteVendorRequest** - 견적 요청 발송 단위
```prisma
model QuoteVendorRequest {
  id          String              @id @default(cuid())
  quoteId     String              // FK to Quote
  vendorName  String?             // 벤더명 (선택)
  vendorEmail String              // 벤더 이메일 (필수)
  message     String?             @db.Text // 요청 메시지
  token       String              @unique // 48자 랜덤 토큰
  status      VendorRequestStatus @default(SENT)
  expiresAt   DateTime            // 만료일 (기본 14일)
  respondedAt DateTime?           // 회신 제출 시간
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
}
```

**QuoteVendorResponseItem** - 품목별 회신
```prisma
model QuoteVendorResponseItem {
  id               String   @id @default(cuid())
  vendorRequestId  String   // FK to QuoteVendorRequest
  quoteItemId      String   // FK to QuoteListItem
  unitPrice        Int?     // 회신 단가
  currency         String   @default("KRW")
  leadTimeDays     Int?     // 납기 (일)
  moq              Int?     // 최소 주문 수량
  vendorSku        String?  // 벤더 SKU
  notes            String?  @db.Text // 비고
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([vendorRequestId, quoteItemId])
}
```

### 2. API 엔드포인트

#### 내부 API

**POST /api/quotes/:id/vendor-requests**
- 설명: 벤더에게 견적 요청 전송
- 권한: 견적서 소유자 또는 guestKey 일치
- 요청:
  ```json
  {
    "vendors": [
      { "email": "vendor@example.com", "name": "벤더명(선택)" }
    ],
    "message": "요청 메시지 (선택)",
    "expiresInDays": 14
  }
  ```
- 응답:
  ```json
  {
    "createdRequests": [
      {
        "id": "req_xxx",
        "vendorEmail": "vendor@example.com",
        "token": "...",
        "shareUrl": "https://domain.com/vendor/token",
        "status": "SENT",
        "expiresAt": "2025-01-10T..."
      }
    ],
    "emailResults": [
      { "email": "vendor@example.com", "success": true }
    ],
    "summary": {
      "total": 1,
      "emailsSent": 1,
      "emailsFailed": 0
    }
  }
  ```

**GET /api/quotes/:id/vendor-requests**
- 설명: 견적서에 대한 벤더 요청 목록 조회
- 권한: 견적서 소유자 또는 guestKey 일치
- 응답: 모든 벤더 요청 + 회신 데이터

#### 공개 API (벤더용)

**GET /api/vendor-requests/:token**
- 설명: 벤더가 견적 요청 내용 조회
- Rate Limit: 60 req/min (IP 기반)
- 응답:
  ```json
  {
    "vendorRequest": {
      "id": "...",
      "vendorName": "...",
      "message": "...",
      "status": "SENT",
      "expiresAt": "..."
    },
    "quote": {
      "id": "...",
      "title": "견적 제목",
      "currency": "KRW"
    },
    "items": [
      {
        "id": "item_xxx",
        "lineNumber": 1,
        "name": "제품명",
        "brand": "브랜드",
        "catalogNumber": "카탈로그번호",
        "unit": "ea",
        "quantity": 10,
        "existingResponse": null
      }
    ]
  }
  ```

**POST /api/vendor-requests/:token/response**
- 설명: 벤더가 견적 회신 제출
- Rate Limit: 10 req/min (IP 기반)
- 요청:
  ```json
  {
    "items": [
      {
        "quoteItemId": "item_xxx",
        "unitPrice": 10000,
        "currency": "KRW",
        "leadTimeDays": 7,
        "moq": 1,
        "vendorSku": "ABC123",
        "notes": "비고"
      }
    ],
    "vendorName": "벤더명(선택)"
  }
  ```
- 응답:
  ```json
  {
    "ok": true,
    "respondedAt": "2025-12-27T...",
    "message": "견적 회신이 성공적으로 제출되었습니다."
  }
  ```
- 제약사항:
  - 만료된 요청: 410 에러
  - 이미 회신한 요청: 409 에러 (재제출 불가)
  - 취소된 요청: 410 에러

### 3. 이메일 발송 (SendGrid)

#### 환경변수
```env
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@bioinsight-lab.com
NEXT_PUBLIC_APP_URL=https://bioinsight-lab.com
```

#### 이메일 템플릿
- 제목: `[BioInsight Lab] 견적 요청서 회신 부탁드립니다`
- 내용:
  - 견적 정보 (제목, 품목 수, 회신 마감일)
  - 요청 메시지
  - 회신 링크 버튼
  - 주의사항 (만료일, 로그인 불필요)

#### 발송 실패 처리
- 벤더별 성공/실패 배열 반환
- 실패해도 다른 벤더 발송 계속 진행
- 콘솔 로그 기록

### 4. 보안 및 검증

#### 토큰 생성
- **길이**: 48자
- **방식**: crypto.randomBytes(32) → base64url
- **추측 불가능**: 2^256 조합
- **형식**: `[A-Za-z0-9_-]{48}`

#### Rate Limiting
- **조회**: 60 req/min (IP 기반)
- **제출**: 10 req/min (IP 기반)
- **헤더**: X-RateLimit-*

#### 검증
- 토큰 형식 검증
- 만료일 체크 (서버 사이드)
- 상태 검증 (SENT만 회신 가능)
- 중복 제출 방지 (RESPONDED 후 차단)
- QuoteItem ID 검증

#### 민감정보 보호
- 공개 API에서 내부 메모, 사용자 정보 제외
- 최소한의 데이터만 반환

---

## 📁 생성된 파일

### 데이터베이스
1. `prisma/schema.prisma` (업데이트)
2. `prisma/migrations/20251227_add_vendor_request_response/migration.sql`

### API Routes
3. `src/app/api/quotes/[id]/vendor-requests/route.ts` - POST, GET
4. `src/app/api/vendor-requests/[token]/route.ts` - GET
5. `src/app/api/vendor-requests/[token]/response/route.ts` - POST

### Libraries
6. `src/lib/api/vendor-request-token.ts` - 토큰 생성/검증
7. `src/lib/email/vendor-request-templates.ts` - 이메일 템플릿

### Documentation
8. `VENDOR_RESPONSE_FEATURE.md` (이 파일)

---

## 🚀 사용 방법

### 1. 환경 설정
```bash
# .env 파일에 추가
SENDGRID_API_KEY=your_api_key
SENDGRID_FROM_EMAIL=noreply@your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. 마이그레이션 적용
```bash
cd apps/web
npm run db:migrate
npm run db:generate
```

### 3. API 사용 예시

#### 내부: 벤더에게 요청 전송
```typescript
const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vendors: [
      { email: "vendor1@example.com", name: "Vendor A" },
      { email: "vendor2@example.com" }
    ],
    message: "안녕하세요. 아래 품목에 대한 견적 부탁드립니다.",
    expiresInDays: 14
  }),
});

const { createdRequests, emailResults } = await response.json();
```

#### 벤더: 견적 조회
```typescript
const response = await fetch(`/api/vendor-requests/${token}`);
const { vendorRequest, quote, items } = await response.json();
```

#### 벤더: 견적 회신 제출
```typescript
const response = await fetch(`/api/vendor-requests/${token}/response`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [
      {
        quoteItemId: "item_xxx",
        unitPrice: 10000,
        leadTimeDays: 7,
        notes: "재고 있습니다"
      }
    ],
    vendorName: "우리 회사"
  }),
});
```

---

## 🎨 UI 구현 가이드

### 1. 내부 페이지: /test/quote에 "견적 요청 보내기" 추가

```typescript
// 컴포넌트: VendorRequestModal.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function VendorRequestModal({ quoteId, open, onClose }) {
  const [vendors, setVendors] = useState([{ email: "", name: "" }]);
  const [message, setMessage] = useState(
    "안녕하세요.\n\n아래 품목에 대한 견적 부탁드립니다.\n\n감사합니다."
  );
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/vendor-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendors, message, expiresInDays }),
      });

      if (!response.ok) throw new Error("Failed to send");

      const result = await response.json();
      toast.success(`${result.summary.emailsSent}개 벤더에게 전송 완료`);
      onClose();
    } catch (error) {
      toast.error("전송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>견적 요청 보내기</DialogTitle>
        </DialogHeader>

        {/* 벤더 입력 필드들 */}
        <div className="space-y-4">
          {vendors.map((vendor, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input
                placeholder="이메일"
                value={vendor.email}
                onChange={(e) => {
                  const newVendors = [...vendors];
                  newVendors[i].email = e.target.value;
                  setVendors(newVendors);
                }}
              />
              <Input
                placeholder="벤더명 (선택)"
                value={vendor.name}
                onChange={(e) => {
                  const newVendors = [...vendors];
                  newVendors[i].name = e.target.value;
                  setVendors(newVendors);
                }}
              />
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() => setVendors([...vendors, { email: "", name: "" }])}
          >
            + 벤더 추가
          </Button>

          <Textarea
            label="요청 메시지"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
          />

          <Input
            type="number"
            label="만료 기간 (일)"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            min={1}
            max={90}
          />

          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? "전송 중..." : "견적 요청 전송"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. 공개 페이지: /vendor/[token]

```typescript
// 페이지: src/app/vendor/[token]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VendorResponsePage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/vendor-requests/${token}`)
      .then((res) => res.json())
      .then(setData);
  }, [token]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const items = Object.entries(responses).map(([quoteItemId, response]) => ({
      quoteItemId,
      ...response,
    }));

    const response = await fetch(`/api/vendor-requests/${token}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (response.ok) {
      alert("견적 회신이 제출되었습니다!");
      // 완료 화면으로 이동
    }
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">견적 회신 제출</h1>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <p><strong>견적 제목:</strong> {data.quote.title}</p>
        <p><strong>만료일:</strong> {new Date(data.vendorRequest.expiresAt).toLocaleString()}</p>
        {data.vendorRequest.message && (
          <p className="mt-2 whitespace-pre-wrap">{data.vendorRequest.message}</p>
        )}
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th>품목</th>
            <th>수량</th>
            <th>단가</th>
            <th>납기(일)</th>
            <th>MOQ</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.quantity} {item.unit}</td>
              <td>
                <Input
                  type="number"
                  placeholder="단가"
                  onChange={(e) => {
                    setResponses({
                      ...responses,
                      [item.id]: {
                        ...responses[item.id],
                        unitPrice: parseInt(e.target.value),
                      },
                    });
                  }}
                />
              </td>
              <td>
                <Input
                  type="number"
                  placeholder="납기"
                  onChange={(e) => {
                    setResponses({
                      ...responses,
                      [item.id]: {
                        ...responses[item.id],
                        leadTimeDays: parseInt(e.target.value),
                      },
                    });
                  }}
                />
              </td>
              <td>
                <Input
                  type="number"
                  placeholder="MOQ"
                  onChange={(e) => {
                    setResponses({
                      ...responses,
                      [item.id]: {
                        ...responses[item.id],
                        moq: parseInt(e.target.value),
                      },
                    });
                  }}
                />
              </td>
              <td>
                <Input
                  placeholder="비고"
                  onChange={(e) => {
                    setResponses({
                      ...responses,
                      [item.id]: {
                        ...responses[item.id],
                        notes: e.target.value,
                      },
                    });
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 w-full"
      >
        {submitting ? "제출 중..." : "견적 회신 제출"}
      </Button>
    </div>
  );
}
```

### 3. 내부: 회신 비교 UI

```typescript
// 컴포넌트: VendorResponsesComparison.tsx
export function VendorResponsesComparison({ quoteId }) {
  const [vendorRequests, setVendorRequests] = useState([]);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}/vendor-requests`)
      .then((res) => res.json())
      .then((data) => setVendorRequests(data.vendorRequests));
  }, [quoteId]);

  return (
    <div>
      <h2>벤더 회신 비교</h2>

      <table className="w-full">
        <thead>
          <tr>
            <th>벤더</th>
            <th>상태</th>
            <th>회신일</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {vendorRequests.map((req) => (
            <tr key={req.id}>
              <td>{req.vendorEmail}</td>
              <td>
                <Badge variant={
                  req.status === "RESPONDED" ? "success" :
                  req.status === "EXPIRED" ? "destructive" : "default"
                }>
                  {req.status}
                </Badge>
              </td>
              <td>{req.respondedAt ? new Date(req.respondedAt).toLocaleString() : "-"}</td>
              <td>
                {req.status === "RESPONDED" && (
                  <Button size="sm" onClick={() => viewResponse(req)}>
                    회신 보기
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## ✅ 체크리스트

### 개발
- [x] Prisma 스키마 설계
- [x] 마이그레이션 파일 생성
- [x] 토큰 생성 유틸리티
- [x] SendGrid 이메일 템플릿
- [x] POST /api/quotes/:id/vendor-requests
- [x] GET /api/quotes/:id/vendor-requests
- [x] GET /api/vendor-requests/:token
- [x] POST /api/vendor-requests/:token/response
- [x] Rate limiting
- [x] 문서화

### 테스트 (수동)
- [ ] 마이그레이션 적용 확인
- [ ] 벤더 요청 생성 → 이메일 발송 확인
- [ ] 이메일 링크 클릭 → 공개 페이지 접근
- [ ] 견적 회신 제출 → DB 저장 확인
- [ ] 만료된 요청 접근 → 410 에러
- [ ] 중복 제출 → 409 에러
- [ ] Rate limiting 테스트

### UI (구현 필요)
- [ ] /test/quote에 "견적 요청 보내기" 버튼
- [ ] VendorRequestModal 컴포넌트
- [ ] /vendor/[token] 페이지
- [ ] 회신 비교 UI
- [ ] CSV 내보내기

---

## 📝 Notes

### RFQ 용어 금지
- UI에서 "RFQ" 사용 금지
- 대신 "견적 요청", "견적 회신" 사용

### 재제출 정책 (MVP)
- 현재: 1회 제출 후 수정 불가 (409 에러)
- 향후: 관리자 승인 하에 1회 수정 허용 가능

### 프로덕션 고려사항
- SendGrid 발송 할당량 확인
- Rate limiting을 Redis로 전환 (멀티 서버)
- 이메일 실패 시 재시도 로직
- 벤더 회신 알림 (내부 사용자에게)

---

**구현 완료일**: 2025-12-27
**버전**: MVP 1.0
**상태**: API 완료, UI 구현 필요
