# 네트워크 진단 결과

## 테스트 결과

### ✅ Transaction Pooler (포트 6543)
- **상태**: 연결 성공 ✅
- **호스트**: `aws-1-ap-northeast-1.pooler.supabase.com:6543`
- **결과**: `TcpTestSucceeded : True`

### ❌ Direct Connection (포트 5432)
- **상태**: DNS 해석 실패 ❌
- **호스트**: `db.xhidynwpkqeaojuudhsw.supabase.co:5432`
- **결과**: `Name resolution failed`
- **원인**: 호스트 주소가 잘못되었거나 Supabase 설정 문제

## 해결 방법

### 1. Supabase 대시보드에서 Direct Connection 주소 확인

1. Supabase 대시보드 → **Settings** → **Database**
2. **Connection Pooling** 섹션으로 이동
3. **Method**를 **"Direct connection"**으로 선택
4. 연결 문자열에서 호스트 주소 확인

**예상 형식:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

또는

```
postgresql://postgres:[PASSWORD]@[IP-ADDRESS]:5432/postgres
```

### 2. .env.local 파일 업데이트

올바른 Direct connection 주소를 확인한 후 `.env.local` 파일의 `DIRECT_URL`을 업데이트하세요.

### 3. 대안: Transaction Pooler 사용

Direct connection이 계속 실패하는 경우:
- **마이그레이션**: Supabase SQL Editor 사용 (권장)
- **Prisma Studio**: 사용 불가 (Direct connection 필요)
- **애플리케이션**: Transaction pooler로 정상 작동 ✅

## 현재 상태

- ✅ DATABASE_URL (Transaction pooler): 연결 가능
- ❌ DIRECT_URL (Direct connection): DNS 해석 실패
- ✅ 네트워크/방화벽: 문제 없음 (포트 6543 접근 가능)

## 권장 사항

1. Supabase 대시보드에서 Direct connection 주소 재확인
2. 올바른 주소로 `.env.local` 업데이트
3. 여전히 실패하면 Supabase SQL Editor 사용 (마이그레이션용)










