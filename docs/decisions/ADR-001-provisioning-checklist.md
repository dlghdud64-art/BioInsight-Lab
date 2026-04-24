# ADR-001 Provisioning Checklist — Option B (Dedicated Supabase Test Project)

- Status: **CLOSED** (2026-04-23 — Supabase 콘솔 작업 완료, 값 기록됨, §11 deviation 확정)
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

## 4. 값 기록 (Phase 1 완료)

```
# Filled by 호영 on 2026-04-23 after Supabase console confirmation
# 2026-04-24: PRODUCTION_PROJECT_REF typo (q→o) corrected — see ADR-002 §11.6
TEST_PROJECT_REF         = qbyzsrtxzlctjvbfcscs
PRODUCTION_PROJECT_REF   = xhidynwpkqeaojuudhsw
TEST_PROJECT_REGION      = ap-northeast-2
PRODUCTION_PROJECT_REGION = ap-northeast-1
TEST_PROJECT_NAME        = labaxis-smoke-test   # deviation §11.1
```

> 위 네 줄은 **secret 이 아니므로** 저장소에 그대로 commit 한다. 실제
> `DATABASE_URL_SMOKE` / database password / service_role key 는 이 파일 또는
> 그 어떤 repo 파일에도 쓰지 말 것.

### 4.1 Runtime 주입 contract (Phase 2 guard 가 검증하는 값)

Smoke 실행 시 shell 에 주입해야 할 env:

```sh
export DATABASE_URL_SMOKE="postgresql://postgres.qbyzsrtxzlctjvbfcscs:<password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
export SMOKE_DB_PROJECT_REF="qbyzsrtxzlctjvbfcscs"
export ALLOWED_SMOKE_DB_SENTINELS="qbyzsrtxzlctjvbfcscs"
export PRODUCTION_DB_PROJECT_REF="xhidynwpkqeaojuudhsw"
```

`DATABASE_URL_SMOKE` 내부의 `<password>` 는 secret. checked-in `.env` 에 들어가면
안 되고, `.env.smoke` 는 `.gitignore` 상태 확인 후에만 사용.

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

1. Supabase 콘솔에 smoke 용 test project 가 확보됨 — deviation §11.1 참고.  ✅
2. §4 값 슬롯(project-ref / production-ref / region / name)이 본 파일에 채워짐 + commit.  ✅ (본 commit)
3. `DATABASE_URL_SMOKE` 가 호영님 로컬/secret manager 에 저장됨 (repo 에는 기록하지 않음 — 확인은 호영님 자가검증).  ✅ (호영님 확인)
4. checked-in `.env` 에 production DATABASE_URL 이 그대로 유지되고 smoke 값이 덮이지 않았음.  ✅ (§5.1 제약 2 준수)
5. Phase 2 guard 가 준비되어 있음.  ✅ (`apps/web/scripts/smoke/guard.ts`, commit 7fbe253e)

5/5 충족 → **Phase 1 CLOSED**. Phase 3 (migrate revision diff) 집행 가능.

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
- 2026-04-23 — §4 값 기입, Status → **CLOSED**, §11 deviations 추가. Phase 3 (migrate revision diff) 집행 조건 충족.

---

## 11. Deviations from the original checklist

본 섹션은 ADR-001 §5.1 제약 준수 하에 발생한 계획 이탈을 공개 기록한다. 이후
Phase 4/5 및 Phase 0 truth reconciliation 이 본 섹션을 참조한다.

### 11.1 Reused existing Supabase project (`labaxis-smoke-test`)

- **계획:** "New project → `labaxis-smoke` 라는 이름으로 신규 생성".
- **실제:** Supabase free plan 의 2-project 한도에 이미 막혀 있어 기존
  `labaxis-smoke-test` 프로젝트를 smoke 역할로 재지정.
- **ADR 제약과의 정렬:**
  - §5.1 제약 1 (production ref ≠ test ref): project-ref 가 전혀 다름
    (`qbyzsrtxzlctjvbfcscs` vs `xhidynwpkqeaojuudhsw`) → 충족.
  - §5.1 제약 3 (host/project-ref guard): guard 는 project-ref 문자열로만 판정
    하므로 project 이름 불일치는 무관 → 충족.
- **Follow-up:** free plan 에서 플랜 업그레이드 또는 branching 가용성이
  확보되면 장기적으로는 smoke 용 전용 project 로 재분리 고려. 현재는 동일
  project 재사용이 운영 측면에서 합리적.

### 11.2 Pre-existing `#16c` seed data coexistence

- **계획:** sentinel-scoped seed 가 비어 있는 test DB 에 들어감.
- **실제:** 기존 `#16c` RFQ canonical smoke 에서 생성된 데이터가 남아 있음.
  재사용 무방 (해당 데이터는 canonical PASS evidence).
- **ADR 제약과의 정렬:**
  - §6.2 (sentinel-scoped writes): sentinel cleanup 은 반드시 **전용 sentinel
    식별자** (`org-smoke-isolated`, `workspace-smoke-isolated` 등) 로만 scope
    되어야 하며, `#16c` 데이터는 **절대 건드리지 않는다**.
  - Phase 4 sentinel-seed / sentinel-cleanup 구현 시 단위 테스트로
    "non-sentinel row 는 cleanup 대상에서 제외" 케이스 강제.
- **Follow-up:** `#16c` 데이터의 org/workspace 식별자가 sentinel 식별자와
  충돌하지 않는지 Phase 4 진입 전에 확인 (read-only query).

### 11.3 Vector extension pre-installed

- **계획:** provisioning 후 extension 설치 별도 확인.
- **실제:** `vector` extension 기설치. S01~S03 이 vector 경로를 트리거하는
  경우 production parity 유지됨.
- **ADR 제약과의 정렬:** 추가 작업 없음. 다만 Phase 5 connection probe 에서
  `vector` extension 존재를 read-only 로 확인할 수 있으면 좋음 (선택).

### 11.4 Prisma migrations already applied (4 migrations)

- **계획:** Phase 3 에서 `prisma migrate deploy` 로 최초 배포.
- **실제:** 4 migrations 기적용. Phase 3 는 "최초 deploy" 가 아니라
  "revision diff 검증" 으로 축소.
- **ADR 제약과의 정렬:** §7 criteria 3 (Prisma migrate 동일 revision) 은
  "deploy 를 실행" 이 아니라 "production 과 동일 revision set" 을 요구함.
  Phase 3 operator 산출물(`migrate-revision-diff.ts`) 로 충족 확인.
