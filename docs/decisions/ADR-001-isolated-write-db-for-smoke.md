# ADR-001: Isolated WRITE DB for #26 S01/S02/S03 Smoke

- Status: **ACCEPTED** (general manager selected Option B on 2026-04-23; see §5)
- Date opened: 2026-04-23
- Owner: 호영 (총괄관리자)
- Operator (drafting only): Claude (labaxis-bug-hunter + delivery-planner governance)
- Related: `#26 S07/S08` closeouts, `docs/reports/26-critical-route-smoke-report.md`, `#26a` preflight Stop #1

## 1. Context

`#26` critical route smoke에서 S07 (admin auth) 및 S08 (admin read-only)은 본 세션에서 CLOSED 판정되었다. 남은 S01/S02/S03은 WRITE chain으로, 실행하면 Quote·Order·Inventory 등에서 canonical truth에 직접 mutation이 일어난다.

`#26a` preflight에서 확인된 Stop #1: 현재 `DATABASE_URL`은 Supabase pooler endpoint로, production과 test 프로젝트를 호스트 문자열만으로는 구분할 수 없다. 따라서 지금 상태에서 S01~S03을 돌리면 production canonical truth에 직접 쓰기가 발생한다. 수용 불가.

본 결정서의 목적은 production과 물리적으로 분리된 WRITE 대상 DB 경로를 고정하고, S01~S03 재개 전에 반드시 통과해야 할 acceptance criteria를 못 박는 것이다.

## 2. Non-goals

- LabAxis 제품 원칙(연구 구매 운영 OS / same-canvas / canonical truth 보호 / dead button·no-op 금지) 변경 없음.
- S01~S03 smoke spec 자체의 재정의 없음 (본 ADR은 "어느 DB에 쓸 것인가"만 결정).
- pgvector 제거 / LLM 파이프라인 인프라 변경 없음.
- 어떤 옵션을 선택하든 본 ADR에서 실제 DB provisioning 을 수행하지 않는다. Provisioning 은 ADR merge 후 별도 commit.

## 3. Decision drivers

| # | Driver | 비고 |
| --- | --- | --- |
| D1 | Production canonical truth 격리 | 타협 불가 |
| D2 | Prisma extension parity (pgvector 등) | S01~S03 경로가 실제 사용하는지 확인 필요 |
| D3 | Distinguishable DATABASE_URL (실수 방지) | host 문자열만으로 production 과 구분 가능해야 함 |
| D4 | Rollback safety | production 오염 감지 시 즉시 대응 가능한가 |
| D5 | Setup cost (시간 · infra · billing) | 팀 현재 리소스 관점 |
| D6 | 재사용성 (로컬 dev + CI + preview) | 반복 smoke에 적합한가 |

## 4. Options

세 가지로 한정한다. 각 옵션은 동일 Driver 매트릭스로 비교한다.

### Option A — Localhost Postgres (Docker 또는 native)

**개요**  
개발자 머신 또는 로컬 CI 러너에서 Postgres 인스턴스를 띄우고, Prisma migrate + 시드로 schema 재현.

- **D1 (격리):** 강함. production network와 완전히 분리.
- **D2 (extension parity):** 약함. pgvector 등 production extension은 수동 설치. S01~S03이 실제 vector search를 트리거하는지 **먼저 확인** 필요.
- **D3 (distinguishable URL):** 매우 강함. `postgresql://localhost:5432/...` 는 production pooler와 문자열 수준에서 다름.
- **D4 (rollback):** 단순. 컨테이너 재생성 혹은 `prisma migrate reset`으로 원복.
- **D5 (cost):** 0원. Docker 이미지 + 디스크.
- **D6 (재사용성):** 로컬 위주. CI에서도 돌릴 수 있으나 preview 배포에서는 부적합.

**Setup 개략 스텝**
1. `docker compose up -d postgres` 또는 native Postgres 설치
2. `DATABASE_URL=postgresql://localhost:5432/labaxis_smoke` 전용 env 파일로 고정
3. `pnpm prisma migrate deploy` + seed 스크립트
4. smoke 러너가 위 URL만 사용하도록 가드

**주요 risk**
- 실제 운영 환경에서 pgvector/RLS 차이로 S01~S03 결과가 production behavior와 어긋날 수 있음.
- 팀 여러 명이 쓸 때 로컬 데이터 drift 발생.

### Option B — Dedicated Supabase test project (production과 다른 project-ref)

**개요**  
Supabase 콘솔에서 별도 프로젝트(`labaxis-smoke` 등)를 생성하고, production과 별도 project-ref / key / pooler endpoint 를 사용.

- **D1 (격리):** 강함. project-level isolation. 다만 "사람이 URL을 잘못 덮어쓰는" 휴먼 에러 여지 남음.
- **D2 (extension parity):** 매우 강함. production과 거의 동일한 extension, pooler, RLS 동작.
- **D3 (distinguishable URL):** 중간. host 문자열이 둘 다 `*.pooler.supabase.com` 형태. project-ref 부분만 다름. 허용 리스트 가드 필수(§6).
- **D4 (rollback):** project 단위 reset 또는 row 단위 cleanup. production 오염 가능성 물리적으로 0에 가까움 (project 분리).
- **D5 (cost):** Supabase 플랜에 따라 별도 billing line 1건 추가. Free tier 가능 여부는 사용 패턴에 따라.
- **D6 (재사용성):** 매우 강함. 로컬, CI, preview 배포 모두 동일 URL 공유.

**Setup 개략 스텝**
1. Supabase console에서 새 project 생성 (`labaxis-smoke` 등, production 과 다른 region 또는 명시적 이름)
2. production schema를 migrate 실행
3. seed 스크립트로 smoke용 sentinel org/workspace 주입
4. 팀 secret 저장소에 별도 key 등록 (production key 와 분리)
5. smoke 러너가 test project-ref 만 허용하도록 가드

**주요 risk**
- production key 와 test key 가 섞이면 바로 production mutation. 허용 리스트 가드(§6) 없이는 위험.
- Supabase 변경 사항(예: pooler endpoint 변경)에 양쪽 모두 영향.

### Option C — Supabase branches (Postgres branching)

**개요**  
기존 production project 내부에서 dev/test branch를 생성해 schema copy + isolated storage 사용. Supabase 공식 branching 기능.

- **D1 (격리):** 강함 (branch-level). 다만 branch 모델이 production project 안에 붙는 개념이라, UI 실수로 production branch를 건드릴 가능성 존재.
- **D2 (extension parity):** 매우 강함. 동일 project 기반이므로 pgvector/RLS 그대로.
- **D3 (distinguishable URL):** 중간. branch-ref가 주입되나 host 패턴은 유사. §6 가드 필수.
- **D4 (rollback):** branch 삭제 또는 reset으로 깨끗하게 원복.
- **D5 (cost):** Supabase 플랜/기능 가용성에 따라 다름. Team/Pro 플랜 여부 먼저 확인 필요. 현재 조직 플랜 상태는 본 ADR 범위 밖 (manager confirmation 필요).
- **D6 (재사용성):** 매우 강함. PR 단위로 branch 자동 생성 패턴까지 가능.

**Setup 개략 스텝**
1. Supabase 조직 플랜이 branching 지원하는지 manager 확인
2. production project에서 `smoke` branch 생성
3. branch에 schema migrate 실행
4. branch 전용 credential을 smoke 러너에 연결
5. §6 가드로 branch-ref 만 허용

**주요 risk**
- 플랜 미지원 시 즉시 불가.
- branching 기능 semantics 가 Supabase 업데이트에 따라 바뀔 수 있음.

## 5. Recommendation — ACCEPTED

- **Chosen option:** **B — Dedicated Supabase test project** (production과 다른 project-ref)
- **Rationale (3 lines):**
  1. pgvector / Prisma baseline이 production과 동일하게 유지되어 S01~S03 결과가 production behavior와 일치.
  2. production project-ref ≠ test project-ref 를 문서로 증명 가능 → canonical truth 오염 방지를 가장 깔끔하게 보장.
  3. Windows native pgvector 빌드 / Docker / WSL 의존 경로보다 운영 비용이 낮고 재사용성(로컬·CI·preview)이 높음.
- **Expected setup window:** 2~4시간 (Supabase project 생성 + migrate + seed + §6 가드 + dry-run 기준). provisioning 본 ADR commit 이후 별도 트랙.

### 5.1 Option B 운영 제약 (채택 시 함께 고정)

호영님이 §5 확정과 함께 명시한 4개 제약을 본 ADR에서 "구속력 있는 제약"으로 못 박는다. §6 가드 구현과 §7 acceptance criteria 는 모두 아래 4개 위에서 작동한다.

1. **production project-ref ≠ test project-ref 를 문서로 명시.** 두 URL의 project-ref (username 구간 또는 host 구간)를 본 저장소 안에 plain text로 기록. key/비밀값은 저장하지 않되, project-ref 문자열 자체는 구분 용도로 공개 가능하게 두어 human-readable diff 를 가능케 함.
2. **`.env` 파일 직접 수정 금지. 세션 env override 우선.** smoke 실행은 shell-level env injection (예: `DATABASE_URL=... pnpm tsx smoke/...`) 또는 ephemeral `.env.smoke` 파일 + gitignore 로 처리. repo 에 체크인된 `.env` 를 건드려 production URL 을 덮어쓰지 않는다.
3. **`host/project-ref guard` 를 smoke runner 진입부에 필수 배치.** DATABASE_URL 의 project-ref 가 허용 리스트(ALLOWED_SMOKE_DB_SENTINELS) 에 없으면 즉시 abort. fallback 허용 금지 (§6.1).
4. **production write / cleanup 의존 smoke / raw SQL workaround 모두 금지.** 어떤 이유로든 guard 를 bypass 하는 우회 경로는 본 ADR 위반. 실수로 production project-ref 가 등재되면 PR reviewer 가 거부한다.

## 6. Rollback / Cleanup / Project-ref Guard

세 옵션 어느 쪽을 고르든 아래 가드를 동일하게 적용한다.

### 6.1 pre-smoke host-tail guard
- smoke 러너 시작 시 `DATABASE_URL` 을 파싱해 host tail + project-ref(또는 DB name)를 허용 리스트(`ALLOWED_SMOKE_DB_SENTINELS`)와 비교.
- 일치하지 않으면 runner 가 governance message 출력 후 **즉시 abort**. 어떠한 fallback도 허용하지 않음(fail-closed).
- 허용 리스트는 env var로 주입되며 production project-ref는 절대 등재하지 않는다.
- 본 guard는 smoke 러너 내부 unit test로 직접 검증 (허용 / 차단 각각 1 케이스 이상).

### 6.2 sentinel-scoped writes
- S01~S03이 생성하는 모든 row는 dedicated sentinel 식별자(`org-smoke-isolated`, `workspace-smoke-isolated` 등) 하위로만 쓴다.
- 기존 canonical org/workspace에는 어떤 mutation도 금지.
- 각 smoke 케이스 종료 시 cleanup 스크립트가 sentinel 식별자 기준으로 전체 row를 삭제한다.
- cleanup 실패 시 smoke는 PASS 판정을 받지 못한다.

### 6.3 production contamination 탐지
- 주기적(또는 release window 직전) production audit query: sentinel 식별자 문자열이 production DB에 존재하는지 검사.
- 발견 시 INCIDENT log 즉시 기록 + smoke 러너 사용 전면 중단 + §6.1 guard 원인 분석.
- rollback 은 코드 차원이 아니라 "오염된 행만 삭제 + guard 강화" 절차로 수행한다.

### 6.4 secret 분리
- test DB credential 은 production credential 과 동일 secret manager 키에 저장하지 않는다.
- 네이밍은 `DATABASE_URL_SMOKE` 등 suffix 로 분리. 누구나 육안으로 구분 가능해야 한다.

## 7. Acceptance criteria (S01/S02/S03 재개 전 필수 통과)

1. 본 ADR merge + §5 채움 완료.
2. 선택된 옵션에 따라 isolated DB provisioning 완료 (본 ADR 외부 commit).
3. Prisma migrate 가 production ledger 와 동일 revision 에서 돌아갔음을 확인.
4. §6.1 host-tail guard 구현 + unit test PASS.
5. §6.2 sentinel-scoped seed + cleanup 스크립트 dry-run PASS.
6. smoke 러너가 isolated DB 에만 접속하는 것을 read-only probe 1회로 확정 (production 으로 fall-through 없음).

여섯 개 중 하나라도 미충족 → `#26 S01/S02/S03` 재개 금지.

## 8. Out of scope (follow-up tracks)

- CI 파이프라인 통합(현재는 manual trigger 상정).
- 모바일 앱 smoke 와의 연동.
- `#29` `/admin/users` data mismatch, `#31` `/admin` hydration errors, `#17(?)` `/api/admin/orders` spec, `#30.1` legacy page.tsx 실파일 삭제, `#28.1` `/api/quotes/my` 드리프트.
- 신규 admin 페이지 생성, redesign, page-per-feature 트리 추가.

## 9. Changelog

- 2026-04-23 — 초기 skeleton 작성 (`Status: PROPOSED`). §5 미채움.
- 2026-04-23 — §5 Option B 채택 (`Status: ACCEPTED`). §5.1 에 호영님이 지정한 운영 제약 4개 고정. §6·§7 은 본 제약 위에서 집행된다.
