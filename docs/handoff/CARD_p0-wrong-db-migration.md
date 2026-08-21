# §p0-wrong-db-migration — DDL 과 검증이 같은 잘못된 DB 를 봤다

**등재 2026-08-22** · P0 사고 · 지혈 완료(롤백) · 원인 확정

## 원인 (확정)

```
로컬 .env      DIRECT_URL → ref tvkl…pzqr @ aws-0-ap-northeast-1   **개발 DB**
프로덕션 env    DATABASE_URL → ref xhid…dhsw @ aws-1-ap-northeast-1  **진짜 프로덕션**
```

`prisma migrate deploy` 를 로컬 `.env` 로 실행해 **개발 DB 에 컬럼이 들어갔고**,
프로덕션에는 안 들어간 채 코드가 배포돼 `P2022 Organization.invitePolicy does not exist` 가 났다.

```
영향   조직 목록 API 가 모든 쿼리 오류를 빈 배열로 삼켜(route.ts:48-51)
       "조직 없음" 으로 보임 → 조직 소속 판정 붕괴
구간   배포 16:35경 ~ 롤백까지 약 20여 분
```

## 🛑 왜 검증이 못 잡았나 — 교차검증이 성립하지 않았다

```
적용    로컬 .env → 개발 DB     "All migrations have been successfully applied"
검증    로컬 .env → 개발 DB     information_schema: 컬럼 있음 (jsonb·nullable)
런타임  프로덕션 env → 다른 DB   P2022
```

**두 번 확인했지만 축이 하나였다.** 실측이었으나 대상이 틀렸다.

🔑 §gate-script-silent-fail 의 공통 처방 *"검증은 대상에 닿았음을 스스로 단언한다"* 의 **DB 판**이다.
   게이트는 `무엇을 봤는가`, DB 검증은 `어디를 봤는가` 를 자기 안에 담아야 한다.

## 처방

```
검증 출력에 접속 대상 ref(앞4·뒤4)를 **함께 단언**한다. 기대 ref 와 다르면 그 자리에서 중단.
값 전체는 출력하지 않는다.
```

DEV_RUNBOOK §9.1a 로 표준화했다.

## 부수 원인 — RUNBOOK 자기모순

```
§3.3 (L114)   "Vercel prebuild 가 vercel-migrate.js → prisma migrate deploy 를 자동 실행합니다"
§9.1 / L141 / L215   "OBSOLETE 2026-04-25 (ADR-002 §11.13) — build-time migrate 폐지 · NO-OP"
```

🛑 §9.1 이 경계하는 *"Vercel 이 자동 migrate 한다"는 false promise* 가 **바로 §3.3 그 줄이었다.**
   §9 는 고쳐졌는데 §3.3 이 옛 약속을 들고 있었다.
   **문서가 자기모순일 때 읽는 사람은 먼저 만난 절을 믿는다.** §3.3 을 정정했다.

## 두 번째 함정 — operator 경로가 실행 불가였다

`vercel-migrate.js` 은퇴 커밋이 `schema.prisma` 의 `directUrl` 도 함께 지웠다.
그래서 `prisma migrate deploy` 가 `DATABASE_URL`(:6543 트랜잭션 풀러)로 붙어
`Schema engine error` 로 멈췄다 — RUNBOOK 이 말하는 `operator-shell only` 가 **실제로는 실행 불가**였다.

우회: `DATABASE_URL="<DIRECT_URL 값>" npx prisma migrate deploy` (env 주입 1회성).
   ADR-002 불변 · RUNBOOK L91 에 이미 기재돼 있던 방식이다.

## 남은 조치

```
1  프로덕션 DB(xhid…dhsw)에 ALTER 적용 — dry-run → 승인 → 실행 → ref 병기 확인
2  dpl_4wzJ…(21b7aa7c) 재-promote (재빌드 불필요)
3  QA 6항목 재개
⚪ 개발 DB(tvkl…pzqr)에 들어간 컬럼은 schema.prisma 와 일치하므로 **무해 · 존치**
```

## 관련

- `CARD_gate-script-silent-fail.md` §공통 처방 — 같은 뿌리
- `DEV_RUNBOOK.md` §9.1a(신설) · §3.3(정정)
