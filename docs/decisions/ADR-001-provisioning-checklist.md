# ADR-001 Provisioning Checklist — Option B (Dedicated Supabase Test Project)

- Status: **OPEN** (호영님 콘솔 작업 대기)
- Parent: `docs/decisions/ADR-001-isolated-write-db-for-smoke.md` — §7 criteria 2 집행용
- Owner (execution): 호영 (총괄관리자)
- Operator role: 본 문서에서는 체크리스트만 제공. Supabase 콘솔 / billing / key 발급 어느 것도 자동화하지 않는다.

---

## Why this file exists

ADR-001 §5 에서 Option B (dedicated Supabase test project, production 과 다른 project-ref)가 ACCEPTED. 본 문서는 그 결정을 집행하기 위해 호영님이 Supabase 콘솔에서 수동으로 수행해야 할 순서와 네이밍을 한 장에 고정한다. Operator 가 수행하지 않는 이유는:

- 콘솔 로그인 / 2FA / billing 은 인증·재무 영역이라 operator 범위 밖.
- key 발급·저장은 본 채팅 / repo 어디에도 남기면 안 되며, 호영님이 secret manager 로만 다뤄야 한다.
- ADR-001 §5.1 제약 4 "workaround 금지" 를 지키기 위해 콘솔 단계는 사람이 눈으로 확인해야 한다.

---

## 1. 프로젝트 생성 (콘솔)

Supabase 콘솔 → New project.

| 항목 | 값 / 규칙 |
| --- | --- |
| Organization | 기존 production 이 속한 organization 을 그대로 써도 됨 (billing 따로 필요 시 분리 고려) |
| Project name | **`labaxis-smoke`** (고정). 다른 이름 쓰지 말 것 — grep/모니터링이 이 문자열을 기대함 |
| Region | production 과 **다른 region 권고** (사람 눈으로 URL 구분 쉽게). 필수는 아님 |
| Database password | 신규 생성. **production password 재사용 금지** |
| Pricing plan | 팀 결정. Free tier 로 시작해도 smoke 규모에서는 충분. billing line 은 §3 에서 기록 |

프로젝트 생성 완료 후:
- Supabase 가 자동 할당하는 **project-ref** 문자열을 메모.
- project-ref 는 host 의 subdomain 또는 connection string 의 `postgres.<project-ref>` 구간에 노출됨.

---

## 2. 값 분류 — 기록할 것 / 기록하지 말 것

본 ADR §5.1 제약 1 (문서로 명시) + §6.4 (secret 분리) 를 집행한다.

### 2.1 저장소(repo)에 평문으로 기록해도 되는 값

| 값 | 기록 위치 | 이유 |
| --- | --- | --- |
| test project-ref 문자열 | `docs/decisions/ADR-001-provisioning-checklist.md` §4 (본 문서의 Phase 3 업데이트 섹션) | 식별·diff 용. secret 아님 |
| production project-ref 문자열 | 동일 위치 | self-guard 용. secret 아님 |
| project name `labaxis-smoke` | 본 문서 | grep 앵커 |
| region (선택) | 본 문서 | 사람 구분 용 |

### 2.2 저장소에 절대 기록하지 말 것

| 값 | 보관 장소 |
| --- | --- |
| `DATABASE_URL_SMOKE` 전체 connection string | 로컬 secret manager / ephemeral shell session. `.env.smoke` 파일이면 반드시 `.gitignore` 확인. checked-in `.env` 절대 금지 (§5.1 제약 2) |
| test project service_role key | 동일 |
| test project anon key | 동일 |
| database password | 동일 |

**채팅 / PR description / commit message 에도 위 secret 값은 붙이지 말 것.**

---

## 3. Billing line 기록

별도 billing line 이 발생하면 본 섹션에 한 줄로 기록:

```
- YYYY-MM-DD  plan=<plan>  billing_line_id=<id or n/a>  owner=<호영>
```

Free tier 로 시작하면 `plan=Free` 로 기록.

---

## 4. 값 기록 슬롯 (프로젝트 생성 후 호영님이 채움)

아래 3개 줄을 채운 뒤, Phase 2 guard 가 실제 값을 env 로 받아서 검증한다.

```
# Filled by 호영 on YYYY-MM-DD after Supabase console provisioning
TEST_PROJECT_REF     = <여기에 test project-ref 문자열, 예: abcdefghijklmnop>
PRODUCTION_PROJECT_REF = <여기에 production project-ref 문자열>
TEST_PROJECT_REGION  = <예: ap-northeast-2>
```

> 위 세 줄은 **secret 이 아니므로** 저장소에 그대로 commit 가능. 다만 실제 `DATABASE_URL_SMOKE` / password / service key 는 여기에 쓰지 말 것.

---

## 5. Env 주입 (로컬 / CI)

### 5.1 로컬 개발 머신

호영님 로컬에서 smoke 를 돌릴 때:

```sh
# 권장: ephemeral env via shell
export DATABASE_URL_SMOKE="postgresql://postgres.TEST_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"
export SMOKE_DB_PROJECT_REF="TEST_REF"
export ALLOWED_SMOKE_DB_SENTINELS="TEST_REF"
export PRODUCTION_DB_PROJECT_REF="PROD_REF"

# 또는 .env.smoke 파일 (gitignored 확인 후) 에 저장
```

**금지:** checked-in `.env`, `.env.local`, `.env.production` 등에 위 값을 써넣는 행위. (§5.1 제약 2)

### 5.2 CI / Vercel (본 Phase 에서 설정하지 않음)

본 체크리스트는 **로컬 smoke 실행 기준**. CI 통합은 별도 follow-up — ADR-001 Section 8 out-of-scope.

---

## 6. Migrate (Phase 3 에서 집행)

프로젝트 생성 후 곧바로 schema 를 올릴 것.

```sh
# Phase 3 지시문. 본 체크리스트 Phase 1 단계에서는 실행하지 말 것.
DATABASE_URL="$DATABASE_URL_SMOKE" pnpm -C apps/web prisma migrate deploy
```

Operator 는 Phase 3 에서 revision diff 를 확인한다 (production `_prisma_migrations` 과 test project 의 revision set 이 동일한지).

---

## 7. Completion criteria (Phase 1 완료 판정)

아래 5개가 모두 충족되면 Phase 1 CLOSED:

1. Supabase 콘솔에 `labaxis-smoke` 프로젝트 생성됨.
2. §4 세 줄(project-ref / production-ref / region)이 본 파일에 채워짐 + commit.
3. `DATABASE_URL_SMOKE` 가 호영님 로컬/secret manager 에 저장됨 (repo 에는 기록하지 않음 — 확인은 호영님 자가검증).
4. checked-in `.env` 에 production DATABASE_URL 이 그대로 유지되고 smoke 값이 덮이지 않았음.
5. Phase 2 guard 가 준비되어 있음 (별도 트랙, 병렬 진행).

1~5 충족되면 Phase 3 (migrate) 집행 가능.

---

## 8. Prohibited

- production DATABASE_URL 에 test project-ref 가 섞이는 것
- repo 의 checked-in `.env` 를 덮어쓰는 것
- service_role key / password 를 채팅·PR·commit 에 노출하는 것
- `DATABASE_URL_SMOKE` 미설정 상태에서 smoke runner 를 돌리는 것 (Phase 2 guard 가 abort)
- guard 를 우회해 production project-ref 로 smoke 를 돌리는 것

---

## 9. Related

- `docs/decisions/ADR-001-isolated-write-db-for-smoke.md` §5, §5.1, §6, §7
- `apps/web/scripts/smoke/guard.ts` — Phase 2 산출물 (별도 commit)
- `apps/web/src/__tests__/scripts/smoke-guard.test.ts` — Phase 2 테스트
- `docs/DEV_RUNBOOK.md` §7 — env 네이밍 요약 (Phase 2 업데이트)

## 10. Changelog

- 2026-04-23 — 초기 작성 (Phase 1 kickoff). §4 값 슬롯은 호영님 콘솔 작업 후 별도 commit 으로 채움.
