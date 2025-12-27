# IPv6 문제 해결 방법

## 문제 진단 결과

### ✅ Pooler (IPv4 호환)
- `aws-1-ap-northeast-1.pooler.supabase.com:6543` → 연결 성공
- `aws-1-ap-northeast-1.pooler.supabase.com:5432` → 연결 성공

### ❌ Direct Connection (IPv6만 지원)
- `db.xhidynwpkqeaojuudhsw.supabase.co` → IPv6만 존재 (AAAA 레코드)
- IPv4 연결 시도 시 실패

## 해결 방법

### 방법 1: Session Pooler 사용 (권장)

Supabase 대시보드에서:
1. **Connection Pooling** → **Connection String** 탭
2. **Method**를 **"Session pooler"**로 변경
3. 연결 문자열 복사

**장점:**
- IPv4 호환
- 무료
- Direct connection 대안

**단점:**
- Prisma의 일부 기능 제한 가능
- 마이그레이션에는 여전히 문제 있을 수 있음

### 방법 2: IPv4 Add-on 구매

Supabase 대시보드에서:
1. **IPv4 add-on** 버튼 클릭
2. 구매 후 Direct connection 사용 가능

### 방법 3: Supabase SQL Editor 사용 (현재 방법)

Direct connection이 필요할 때:
- Supabase SQL Editor에서 직접 SQL 실행
- 마이그레이션 대신 SQL 파일 실행

## 현재 권장 설정

### DATABASE_URL (Transaction pooler)
```
postgresql://postgres.xhidynwpkqeaojuudhsw:Ghdud902490@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
```
✅ 정상 작동

### DIRECT_URL (대안 필요)
현재 Direct connection은 IPv6만 지원하므로:
- **옵션 1**: Session pooler 사용
- **옵션 2**: Supabase SQL Editor 사용 (마이그레이션용)

## 다음 단계

1. Supabase 대시보드에서 **Session pooler** 연결 문자열 확인
2. 또는 Supabase SQL Editor로 마이그레이션 실행
3. 애플리케이션은 Transaction pooler로 정상 작동 ✅









