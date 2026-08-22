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

## 별건 함정 — RUNBOOK 자기모순 (이번 사고의 원인은 **아니다**)

```
§3.3 (L114)   "Vercel prebuild 가 vercel-migrate.js → prisma migrate deploy 를 자동 실행합니다"
§9.1 / L141 / L215   "OBSOLETE 2026-04-25 (ADR-002 §11.13) — build-time migrate 폐지 · NO-OP"
```

🛑 **정정 (2026-08-22)** — 처음에 이 절을 "부수 원인" 으로 적었으나 **틀렸다.**
   사무국 오판의 직접 근원은 §3.3 을 읽고 속은 것이 아니라
   **파일명(`vercel-migrate.js`)만 보고 동작을 추정한 것**이었다 — 문서를 안 읽었다.
   §7(표기를 근거로 삼지 않는다)의 전형이고 책임 소재는 사무국 쪽이다.

   ⚠️ 그럼에도 §3.3 정정은 정당하다 — **다음 사람을 속일 실재 함정**이었기 때문이다.
   원인이 아니었다는 것과 고칠 필요가 없다는 것은 다른 이야기다.

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

## ⏸ 열린 리스크 — 프로덕션 DB 비밀번호 (호영님 2026-08-22 "나중에" 판단)

복구 과정에서 **프로덕션 세션 풀러 URL 이 비밀번호째로 대화에 붙여졌다.**
대화 기록·요약·로그에 남는 값이라 회전이 필요하다.

```
상태   미조치 (의도적 보류)
조치   Supabase → Project Settings → Database → Reset database password
       → Vercel 환경변수 DATABASE_URL 갱신 → 재배포
순서   앱이 못 붙는 구간이 생기므로 배포가 안정된 시점에
```

🛑 **이 줄이 있는 이유** — 보류 판단은 정당하나, 대화에만 있으면 다음 세션이 모른다.
   미조치 리스크는 레포에 남는다(2026-08-22 §7: 대화는 휘발되고 레포는 남는다).

⚠️ 회전 전까지는 그 자격증명이 유효하다고 가정하고 다룬다 —
   새 값을 채팅에 붙이지 않는다(이번 노출이 그렇게 생겼다).

## 관련

- `CARD_gate-script-silent-fail.md` §공통 처방 — 같은 뿌리
- `DEV_RUNBOOK.md` §9.1a(신설) · §3.3(정정)
