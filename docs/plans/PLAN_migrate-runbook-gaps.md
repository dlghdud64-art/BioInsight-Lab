# 마이그레이션 런북 구멍 2건 — §migrate-pooler-deadlock · §migration-extension-gap

- **Status:** 등재 (2026-08-12) · 교정 미착수 · **절차로 우회 중**
- **발견 경위:** 개발 DB 전환에서 53개 replay 를 돌리다 둘 다 걸렸다.
- ⚠️ **둘 다 개발 전용 문제가 아니다. 운영에서 같은 자리에서 걸린다**(호영님).

---

## §migrate-pooler-deadlock — `migrate deploy` 가 6543 에서 **무한 대기**한다

### 증상

`npx prisma migrate deploy` 가 **10분 넘게 아무 출력 없이 멈춘다.**
에러도 타임아웃도 없다. DB 쪽에는 테이블 0, `_prisma_migrations` 조차 생기지 않는다.

### 원인

```prisma
datasource db {
  url = env("DATABASE_URL")
  // directUrl = env("DIRECT_URL") — removed 2026-04-25 (ADR-002 §11.13).
}
```

`directUrl` 이 제거돼 있어 migrate 가 **`DATABASE_URL` 을 쓴다.**
그 값은 **6543 transaction pooler**(`?pgbouncer=true`)이고,
거기서는 마이그레이션이 **advisory lock 을 잡지 못해 그대로 매달린다.**

⚠️ **에러가 나지 않는 것이 이 결함의 본체다.** 실패로 드러나면 5분이면 원인을 찾는다.
무출력 대기는 "느린가 보다" 로 읽히고, 그동안 아무 일도 일어나지 않는다.

### 지금의 우회 (절차)

실행 시 `DATABASE_URL` 을 **`DIRECT_URL`(5432 세션 풀러) 값으로 덮어쓴다.**

```bash
DATABASE_URL="<DIRECT_URL 값>" npx prisma migrate deploy
```

스키마와 ADR-002 는 건드리지 않는다.

### 🛑 운영에도 온다

운영에 `migrate deploy` 를 돌릴 때 **같은 자리에서 멈춘다.**
지금은 사람이 오버라이드를 기억해야 하고, **기억은 실패한다**(호영님).

**배포 런북에 명시할 것:**
> `migrate deploy` 는 **반드시 5432 세션 풀러**로 실행한다.
> 오버라이드 없이 실행하면 **무한 대기하며 에러도 남지 않는다.**

ADR-002(빌드타임 migrate 영구 폐기)를 뒤집을지는 **별건**이다.
지금은 절차로 막고 기록만 한다.

---

## §migration-extension-gap — 마이그레이션만으로는 새 DB 가 서지 않는다

### 증상

`0_init` 실패:

```
Database error code: 42704
ERROR: type "vector" does not exist
```

### 원인

운영 DB 에는 **pgvector 확장이 켜져 있는데** 마이그레이션 파일 어디에도
`CREATE EXTENSION` 이 없다. 확장은 **Supabase 대시보드에서 손으로 켠 것**이고
그 사실이 코드에 남지 않았다.

### 🛑 함의 — 재해복구가 성립하지 않는다

**53개를 다 돌려도 새 DB 가 서지 않는다.**
즉 **마이그레이션만으로 운영을 재구축할 수 없다.**

### 확장 차이 대조 방법 (다음에 또 필요하다 — 호영님)

두 DB 에 각각 붙어 `pg_extension` 을 읽고 비교한다. **read-only** 다.

```sql
select extname, extnamespace::regnamespace::text as schema
from pg_extension order by extname;
```

**2026-08-12 실측 결과:**

| 확장 | 운영 | 개발(신규) |
|---|---|---|
| `pg_stat_statements` (extensions) | ✅ | ✅ |
| `pgcrypto` (extensions) | ✅ | ✅ |
| `plpgsql` (pg_catalog) | ✅ | ✅ |
| `supabase_vault` (vault) | ✅ | ✅ |
| `uuid-ossp` (extensions) | ✅ | ✅ |
| **`vector` (extensions)** | ✅ | ❌ **차이 1건** |

→ 차이는 `vector` **하나뿐**이었다. 운영과 **같은 스키마(`extensions`)** 에 생성해 맞췄다:

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

⚠️ 스키마 배치까지 맞춘 이유: 마이그레이션이 `vector` 를 **비수식(unqualified)** 으로
참조한다. 운영에서 동작하는 배치를 그대로 재현해야 replay 가 성립한다.

### 판단 대기

확장 생성을 **마이그레이션에 넣을지**, **런북 선행 단계로 둘지**는 별건 판단이다.
지금은 사실만 기록한다.

- 마이그레이션에 넣으면: 재구축이 자동화된다. 다만 `CREATE EXTENSION` 권한이 필요하고
  Supabase 관리형에서 스키마 배치가 환경마다 다를 수 있다
- 런북에 두면: 코드는 깨끗하나 **기억에 의존**한다 — §migrate-pooler-deadlock 과 같은 약점

---

## 공통 교훈

두 건 다 **"마이그레이션 파일이 곧 스키마" 라는 가정이 틀렸다**는 사실을 드러낸다.
실제 DB 상태 = 마이그레이션 + **손으로 켠 확장** + **연결 경로 선택**.
뒤 둘은 코드에 없고, 그래서 재현이 자동으로 되지 않는다.

**replay 는 그 두 가지를 갖춘 뒤에야 스키마를 재현한다** —
이번 실측이 그것을 증명했다(갖추고 나니 columns 1326 / enums 43 / indexes 511 전 축 일치).
