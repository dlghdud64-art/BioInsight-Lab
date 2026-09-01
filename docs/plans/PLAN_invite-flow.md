# Implementation Plan: 조직 초대 흐름 완성 (§invite-flow b)

- **Status:** 🚧 In Progress (Phase 0·1 완료 · Phase 2 대기)
- **Started:** 2026-08-31
- **Last Updated:** 2026-08-31 (Phase 1 종결 `ecf618e4` — 클로드코드)
- ⛔ **Phase 2 착수 전 선행 조건:** operator-shell `prisma migrate deploy` 로
  `20260831230000_user_active_organization` **prod 적용**. 배포 체인은 적용하지 않는다 —
  `vercel-migrate.js` 는 ADR-002 §11.13 로 영구 NO-OP(실측 2026-08-31).
  Phase 1 코드는 휴면(훅·resolver import 0)이라 미적용 상태로도 무해하지만,
  Phase 2 가 호출자를 이관하는 순간 컬럼 부재는 즉시 런타임 실패다.
- **선행:** §invite-dead-end a (`c1f2d867`) — 초대 진입점 3곳 `INVITE_AVAILABLE=false` disabled + 사유. 이 계획이 서면 그 플래그 하나로 복원한다.
- **승인:** 호영님 2026-08-31 "생성 고" (Cowork 세션). 결정 표 ②(3a 자동 조직 유지 · 별건 후속)는 이의 없음으로 채택.

**CRITICAL**: 각 phase 완료 후 ① 체크박스 ② quality gate 전항 ③ Last Updated ④ Notes ⑤ 다음 phase.
⛔ gate 실패 상태 진행 금지 · 미해결 truth 충돌 상태 진행 금지 · dead button/no-op/placeholder success 금지
⛔ Phase 2(호출자 이관) 완료 전 Phase 3(수락) 배포 금지 — 수락이 먼저 열리면 §org-scope-ambiguity 가 실재로 바뀐다

---

## 0. Truth Reconciliation

### 현행 실측 (2026-08-31 · origin/main `14ac1a9` · 추정 0)

```
생성 절반 (살아 있음)
  api/organizations/[id]/invites/route.ts   POST 토큰 생성(invitePolicy 반영 · adminOnlyInvite 게이트 · OWNER 초대 불가)
                                            GET 목록(revokedAt null) · DELETE revoke(revokedAt)
  prisma OrganizationInvite                 token @unique · email? · role · expiresAt · acceptedAt? · acceptedByUserId? · revokedAt?
                                            → acceptedAt/acceptedByUserId 쓰는 코드 0

수락 절반 (없음)
  app/invite/[token]/page.tsx               부재 (prod https://www.labaxis.co.kr/invite/* → 404 실측)
  OrganizationMember 생성 지점              auth.ts §onboarding-blocker 3a 가입 시 자동 조직 1곳뿐

조직 상세 (a 로 정직화됨)
  [id]/page.tsx  inviteMemberMutation       POST /api/organizations/[id]/members  ← 그 라우트에 POST 핸들러 0 (GET·PATCH·DELETE)
                 resendInviteMutation       POST .../members/resend-invite         ← 라우트 자체 0
                 status === "Pending" 분기  생성 경로 0 인 dead 축 (초대 대기 KPI·필터 칩·행 분기 모두 항상 0)
                 INVITE_AVAILABLE=false     진입점 3곳 disabled + 사유 (c1f2d867)

센티널
  __tests__/ops/invite-accept-pairing.test.ts           I1 수락 화면 없는 동안 settings/workspace 초대 UI 미렌더
                                                        I2 링크 클립보드 복사 금지 · I3 수락 화면 생기면 승계
  __tests__/dashboard/organizations-invite-dead-end-a   I0 수락 화면 생기면 INVITE_AVAILABLE=true 요구(RED 로 알림)
                                                        + 게이트 3곳 계수 · 근거(members POST 0 · resend 0) 실재

좌석 한도
  lib/plans.ts PLAN_LIMITS[plan].maxMembers   FREE 1 · TEAM(Basic) 3 · ORGANIZATION(Pro) null(무제한)
  집행 지점                                   0 (초대 생성·수락 어디에도 없음) — 게이지만 말하고 아무도 막지 않는다

이메일
  lib/email.ts · lib/email/*                  인프라 있음(PO·pilot 템플릿) · 초대 템플릿 0
```

### §org-scope-ambiguity 실측 — ①의 실체

"선택의 거처"(사용자의 현재 활성 조직)가 **없다.**

```
API   organizationMember.findFirst({ where: { userId } })  organizationId 없는 호출  22곳
      (대표: api/team/route.ts:118 — orderBy createdAt asc 로 결정론화, "초대 살아나면 거처를 읽도록 바꿔야" 명시)
UI    orgs[0] · organizations[0] · memberships[0]            17곳 / 13파일
      hooks/use-permission.ts:93   return orgs[0]!           ← 권한 판정이 첫 조직 기준 (가장 무거움)
      components/workspace/workspace-switcher.tsx            selectedOrgId 로컬 state 만 · 영속 0
      admin/safety · dashboard/organizations · safety-spend · settings/{enterprise,plans,audit,billing,security,workspace}
      components/inventory/BulkImportModal.tsx
```

3a 로 모든 사용자가 자기 조직 1개를 자동 보유한다 → **초대 수락 = 즉시 2중 소속** → 위 39곳의 오선택이 잠재에서 실재로 바뀐다. ①은 건너뛸 수 없다. 축소만 가능하다(거처 1개 + resolver 1개 + 훅 1개로 39곳을 치환).

### Conflicts Found
- 없음. §onboarding-blocker #7 의 되살리는 순서(① scope → ② 수락 → ③ 센티널 승계 → ④ UI 복원)와 코드 주석·센티널이 일치한다.

### Chosen Source of Truth
- 코드(origin/main) + 두 센티널의 계약. 문서(§onboarding-blocker #7 주석)는 순서 근거로만 쓴다.

### Environment Reality Check
- [x] repo/branch: `dlghdud64-art/BioInsight-Lab` main · 로컬 작업본 `C:\Users\young\ai-biocompare`
- [x] runnable: `cd apps/web && npx vitest run <paths>` · `npx tsc --noEmit` · `npx prisma migrate dev`(로컬 DB) · pre-push build hook (vitest·build 클로드코드 실행 확인 2026-08-31)
- [x] blockers: 로컬 VM 에서 vitest 불가(Windows node_modules) → 클로드코드 세션이 게이트 실행 · Cowork 세션이 배포본 실측

## 1. Priority Fit

- [ ] P1 immediate
- [x] Release blocker (추정 — 호영님 판정 대기)
- [ ] Post-release
- [ ] P2 / Deferred

**Why:** Basic(3좌석)·Pro(무제한) 플랜의 판매 전제인 "멤버 추가"가 도달 불가다. 좌석 게이지는 한도를 말하지만 아무도 집행하지 않는다. Free 단독 사용엔 영향 0 이라 P1 은 아니다.

## 2. Work Type

- [x] Feature
- [x] Migration / Rollout (nullable 컬럼 1)
- [x] Workflow / Ontology Wiring (활성 조직 resolver)
- [x] Web

## 3. Overview

**Feature Description:** 초대 생성 절반에 수락 절반을 붙여 조직 협업을 도달 가능하게 만든다. 그 전제로 사용자의 활성 조직을 canonical 로 세우고(§org-scope-ambiguity 해소), 좌석 한도를 생성·수락 양쪽에서 집행한다.

**Success Criteria:**
- [ ] 관리자가 조직 상세에서 이메일 초대 → 링크가 수락 화면으로 열린다(404 0)
- [ ] 수락 시 OrganizationMember 가 생기고 activeOrganizationId 가 초대 조직으로 바뀐다
- [ ] 좌석 초과 시 생성·수락 모두 403 + 플랜 변경 안내(게이지가 말하는 한도 = 서버가 막는 한도)
- [ ] API 39곳이 resolver/훅을 통해 활성 조직을 읽는다(직접 `findFirst({userId})`·`orgs[0]` 0)
- [ ] 초대 대기 KPI·리스트·재발송·취소가 OrganizationInvite 로 동작한다(멤버 Pending 축 0)
- [ ] `INVITE_AVAILABLE=true` · dead-end-a I0 · pairing I1~I3 승계 교체 · dead button 0

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 초대 경유 가입 시 3a 자동 조직 생략 (auth.ts 가입 경로 변경 — 별건 후속 트랙)
- [ ] 조직 간 소유권 이전 · 멤버 탈퇴 UI
- [ ] Team(하위 단위) 초대 · 협력사 연결(PartnerOrgTab "Coming Soon" 유지)
- [ ] 이메일 템플릿 디자인 고도화(텍스트 템플릿 1종만)

**User-Facing Outcome:** 관리자: 초대 → 대기 목록에서 상태 확인·재발송·취소. 초대받은 사람: 링크 → (로그인) → 조직명·역할 확인 → 수락 → 그 조직이 활성 상태로 대시보드 진입. 헤더 조직 전환이 영속된다.

## 4. Product Constraints

**Must Preserve:**
- [x] same-canvas — 초대는 기존 모달·승인·초대 탭 안에서. 새 페이지는 `/invite/[token]` 1개만(외부 진입점이라 정당)
- [x] canonical truth — 활성 조직 = `User.activeOrganizationId`(서버) · 초대 상태 = `OrganizationInvite` 컬럼 · 좌석 한도 = `PLAN_LIMITS`
- [x] invalidation — 수락 후 `["organizations"]` · `["organization-members", id]` · `["user-organizations"]` · `["user-org-membership"]` 무효화

**Must Not Introduce:**
- [x] page-per-feature (수락 화면 1개 외 신규 route 0)
- [x] dead button / no-op / placeholder success ("발송 완료" 는 발송 결과가 성공일 때만)
- [x] preview 가 truth 를 덮기 (switcher 로컬 state 가 활성 조직 노릇 금지 — PATCH 로 영속 후 refetch)

**Canonical Truth Boundary:**
- Source of Truth: `User.activeOrganizationId` · `OrganizationInvite.{acceptedAt,acceptedByUserId,revokedAt,expiresAt}` · `OrganizationMember` · `PLAN_LIMITS`
- Derived Projection: 초대 대기 = `acceptedAt IS NULL AND revokedAt IS NULL AND expiresAt > now()` · 좌석 사용 = members.count / maxMembers
- Snapshot / Preview: 없음
- Persistence Path: `PATCH /api/me/active-organization` · `POST /api/invites/[token]/accept`(트랜잭션) · 기존 `/api/organizations/[id]/invites` POST·DELETE

**UI Surface Plan:**
- [x] Existing route section — 조직 상세 모달·승인·초대 탭·KPI · settings/workspace 초대 카드 복원
- [x] New page — `/invite/[token]` (외부 링크 착지점, 유일한 정당 사유)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 활성 조직 = `User.activeOrganizationId` nullable 컬럼 + `resolveActiveOrganizationId(userId)` (활성 → 가장 먼저 가입한 조직 fallback) | API 에서 읽을 수 있는 canonical 이 필요. fallback 은 team route 현행 규칙(createdAt asc) 승계로 무변경 사용자에게 행동 변화 0 | 컬럼 1 · migration 1. 쿠키만으로는 서버 판정 불가 |
| 클라이언트 `useActiveOrganization()` 훅 1개로 `orgs[0]` 13파일 치환 | 오선택을 한 곳에서 고친다 | 기계적 치환 35곳 → 회귀 면적. Phase 2 를 파일별 커밋으로 분할 |
| 좌석 게이트 = 생성 + 수락 양쪽 | 여러 초대가 동시에 수락되면 생성 시점 검사만으론 초과 | 수락 403 사유 화면 1종 추가 |
| 수락 = 트랜잭션(member upsert · acceptedAt/By · activeOrganizationId · audit) | 반쪽 성공(멤버 생김·초대 미수락) 방지 | — |
| 3a 자동 조직 유지 | 가입 경로 무변경 | 초대받은 신규 사용자에게 빈 개인 조직 1개 잔존 — 후속 트랙 |
| 재발송 = 기존 revoke + 새 토큰 + 메일 | 옛 링크 무효화가 곧 보안 | 메일 실패 시 응답에 `mailed:false` → UI 는 링크 복사 fallback 제시(거짓 "발송 완료" 금지) |
| 멤버 `status:"Pending"` 축 은퇴 | 생성 경로 0 인 축을 초대 테이블이 대체 | honest-member-tab 센티널 "상태 배지 활성/초대 대기 두 축" 승계 필요 |

**Dependencies:**
- Required Before Starting: 이 계획 승인(완료) · Phase 2 완료 전 Phase 3 배포 금지
- External Packages: 없음
- Existing Routes / Models / Services Touched: `User`(컬럼 +1) · `OrganizationInvite` · `OrganizationMember` · `api/organizations/[id]/invites` · `api/team` 외 22 API · 13 UI 파일 · `auth.ts`(세션에 activeOrganizationId 노출만, 가입 경로 무변경) · `lib/email`

**Integration Points:**
- 신규: `lib/organizations/active-org.ts`(resolver) · `hooks/use-active-organization.ts` · `api/me/active-organization/route.ts` · `api/invites/[token]/route.ts`(GET 미리보기) · `api/invites/[token]/accept/route.ts` · `app/invite/[token]/page.tsx` · `lib/email/org-invite-template.ts`
- 변경: `api/organizations/[id]/invites/route.ts`(좌석 게이트 + resend) · 조직 상세 · settings/workspace · workspace-switcher · use-permission

## 6. Global Test Strategy

Red-Green-Refactor 엄수. 러너: 클로드코드 세션(`apps/web` vitest·tsc). 배포본 실측: Cowork 세션(로그인 탭).

- resolver·게이트 로직 → 단위 테스트
- accept·invites·me 라우트 → 계약(통합) 테스트(만료·revoke·이미 수락·email 불일치·좌석 초과·정상)
- 호출자 이관 → 인벤토리 센티널(직접 호출 0) + 기존 표면 센티널 전량
- 사용자 경로 → Phase 5 smoke(계정 2개)
- 실행 불가 항목은 "실행 불가" 로 표기, 추정 통과 금지

## 7. Implementation Phases

### Phase 0: Context & Truth Lock (0.5h)
- Status: [x] Complete (2026-08-31 클로드코드)
  - 인벤토리 `docs/plans/inventory/org-scope-callers.md` — API 22 · UI 17(코드 15 + 주석 2, grep 원계수는 계획 §0 과 일치)
  - 판별기 주의: where 절 **brace 매칭** 필수 — 라인 창 휴리스틱은 `select:{organizationId}` 오인·where 밖 사용 오인으로 2회 오판(문서에 기록)
  - 충돌 0 · 범위 재확인(3a 제외 · Team 초대 제외)
- 🔴 위 §0 실측을 파일:줄 인벤토리로 고정 — API 22 · UI 17 목록 파일(`docs/plans/inventory/org-scope-callers.md`)
- 🟢 러너·마이그레이션 명령 확인 · 우선순위 판정 기록
- 🔵 범위 재확인: 3a 제외 · Team 초대 제외
- ✋ Gate: 인벤토리 파일 존재 · 충돌 0
- Rollback: 계획 문서만

### Phase 1: 활성 조직 계약 (3h)
- Status: [x] Complete (2026-08-31 · `ecf618e4`)
  - 산출 8: schema(+컬럼·백릴레이션·`@@index`) · migration · resolver · GET/PATCH 라우트 · 훅 · 테스트 3
  - 게이트 실측: 조직·resolver·라우트·pairing **20파일 162/162 GREEN** · Phase 1 파일 tsc 0
    (전체 tsc 27건은 전부 무관한 기존 `__tests__` 파일 — 선행 상태)
  - 🔧 정합 교정: `@@index([activeOrganizationId])` 를 schema 에 선언 — 마이그레이션은 인덱스를
    만드는데 schema 선언이 없어 **schema↔DDL 드리프트**였다(다음 migrate 가 지우려 든다).
    `migration-drift.test.ts` 는 manifest↔applied 축만 봐서 이 축을 잡지 않는다(무방비 확인).
  - 🔁 게이트 교체 수용: 인벤토리 센티널 `toEqual([])` → **파일별 상한 래칫**.
    원안은 Phase 2 내내 상시 RED 라 신규 위반을 가린다(§11.163/§11.172 부채와 같은 형태).
    래칫은 baseline GREEN · 신규 우회로 즉시 RED · 총계 감소만 허용 · 상한 0 에서 원안으로 수렴.
- 🔴 `__tests__/lib/active-org-resolver.test.ts`: 활성 있음 → 그대로 / 활성 없음 → createdAt asc 첫 조직 / 활성이 탈퇴 조직 → fallback / 조직 0 → null. `__tests__/regression/org-scope-callers-inventory.test.ts`: API 에 organizationId 없는 `organizationMember.findFirst({ where: { userId` 직접 호출 0 (Phase 1 시점엔 RED 22)
- 🟢 migration `User.activeOrganizationId String?` · `lib/organizations/active-org.ts` · `PATCH /api/me/active-organization`(멤버십 검증 후 저장) · `hooks/use-active-organization.ts`(GET /api/organizations + 세션 activeOrganizationId 로 선택, 없으면 첫 조직)
- 🔵 resolver 시그니처 1개로 고정(`{ userId, hint? }`)
- ✋ Gate: resolver 테스트 GREEN · 인벤토리 센티널은 **의도된 RED**(Phase 2 가 닫는다) · tsc 0 · 기존 전량 GREEN
- Rollback: migration down 1 · 신규 파일 4 삭제

### Phase 2: 호출자 이관 (4h · 파일별 커밋)

🛑 **이관 규칙 (리뷰 지적 2026-09-01 · Cowork)**: **mutation surface 는 API·UI 를 같은 phase 에서 짝으로 이관한다.**
   따로 가면 그 사이가 "화면이 보여준 조직 ≠ 적용된 조직" 불일치 창이다 — 에러도 빈 화면도 없이 조용히 틀린다.
   읽기 전용 surface 만 분리 허용. 짝 이관 시 서버(hint 수용)와 화면(명시 전달)을 **한 센티널에 함께** 단언한다
   (한쪽만 잠그면 다른 쪽이 끊겨도 GREEN). 남은 대상은 이 기준으로 재판정한다 —
   생성·수정이 있는 표면(organization-vendors 등)은 짝 이관, 조회 전용은 분리 가능.

- Status: 🚧 진행 중 (7/37 · 래칫 API 16 · UI 14)
  - 선행 해소: prod 마이그레이션 적용 확인 (2026-09-01 · prod `xhid…` 61/61 · `/api/health` pending 0)
  - **2-1 `dff7b538`** — `hooks/use-permission.ts` → `useActiveOrganization()`.
    곁들여 `organization-name-prompt.tsx` 무효화 2키 추가(안 하면 조직 생성 후 권한 stale).
  - **불변식 잠금 `cdf5e054`** — `orgs[0]` 정렬 == resolver fallback 정렬(둘 다 `createdAt asc`) 실측·고정.
    이게 "무변경 사용자 행동 변화 0" 의 유일한 근거다. ⏳ Phase 4 에서 승계 교체 대상(주석에 은퇴 조건).
  - **2-2 `36b1c8a5`·`c317953e`·`b02288d2`·`bbab2c89`** — billing 6곳(invoices 1 · payment-methods 3 · billing 2).
    래칫 API 22 → 16.
  - 게이트(누적): 조직 축 20파일 164/164 · billing 축 22파일 220/220 GREEN · tsc 27 불변(전부 무관 기존 파일)
    · 주입 프로브 전건 RED 후 원복.
  - **2-2 후속 `b519d614`** — 돈 액션 hint 짝 계약. `/billing` 화면은 조직 선택기가 없어 읽기·쓰기가
    모두 활성 조직으로 암묵 해석됐다 → GET 이 `organizationId` 를 알려주고 화면이 그 값을 mutation 3경로에
    실어 "보여준 조직에 적용" 을 보장. 리뷰가 든 plans 시나리오는 **재현되지 않음**(그 경로는
    `/api/organizations/{id}/subscription` 로 이미 조직 명시) — 실측 정정 기록.
  - ⚠️ 배포본 런타임 실측 미실시(콘솔·isLoading·persisted·switcher + billing 화면 3개) — Cowork 세션 로그인 대기.
- 🔴 Phase 1 인벤토리 센티널 RED 22 → 0 을 목표. UI `orgs[0]` 역방향 센티널 추가(13파일에서 `orgs[0]|organizations[0]|memberships[0]` 0)
- 🟢 API 22곳 → `resolveActiveOrganizationId` · UI 13파일 → `useActiveOrganization()`(use-permission 최우선) · workspace-switcher → PATCH + `["user-organizations"]`·`["user-org-membership"]` 무효화
- 🔵 중복 fetch 제거(훅 1개가 `["user-organizations"]` 공유)
- ✋ Gate: 인벤토리 센티널 GREEN(API 0 · UI 0) · 조직·권한·safety·settings 관련 센티널 전량 GREEN · tsc 0 · 단일 조직 사용자 행동 변화 0(Cowork 배포본 실측: 권한·KPI·switcher 동일)
- Rollback: 파일별 커밋 revert(치환은 서로 독립)

### Phase 3: 수락 흐름 + 좌석 게이트 (4h)
- Status: [ ] Pending
- 🔴 `__tests__/api/invites/accept.test.ts`: 토큰 없음 404 · revokedAt 410 · expiresAt 경과 410 · acceptedAt 있음 409 · email 지정 ≠ 세션 email 403 · 이미 멤버 200(멱등, acceptedAt 만 채움) · **좌석 초과 403 `{ code: "SEAT_LIMIT", limit, plan }`** · 정상 200 → member 생성 · acceptedAt/By · activeOrganizationId · auditEvent. `invites POST` 좌석 초과 403 동일 계약
- 🟢 `api/invites/[token]/route.ts` GET(미리보기: 조직명·역할·만료·상태, 토큰만으로 조회 · PII 최소) · `api/invites/[token]/accept/route.ts` POST(트랜잭션) · `app/invite/[token]/page.tsx`(비로그인 → `/auth/signin?callbackUrl=/invite/{token}` · 상태별 5화면: 유효/만료·취소/이미 수락/이미 멤버/좌석 초과 → 플랜 변경 링크는 **관리자에게** 안내 문구) · `invites POST` 에 `countMembers >= maxMembers → 403`
- 🔵 게이트 함수 `assertSeatAvailable(orgId)` 1개를 생성·수락이 공유
- ✋ Gate: accept 계약 8건 GREEN · dead-end-a **근거 실재 단언**은 그대로 GREEN(members POST 는 여전히 없다 — 수락은 별 라우트) · tsc 0 · **배포 금지**(Phase 2 GREEN 전제 재확인)
- Rollback: 라우트 2 + 페이지 1 삭제 · 게이트 함수 제거(컬럼 무관)

### Phase 4: 초대 UI 배선 + 센티널 승계 (3h)
- Status: [ ] Pending
- 🔴 dead-end-a I0: 수락 화면 존재 → `INVITE_AVAILABLE = true` 요구(RED) · pairing I3: settings/workspace 초대 UI 복원 요구(RED) · 조직 상세 신규 센티널: `inviteMemberMutation` → `/invites` POST `{ email, role }` · `Pending` 분기 0 · 초대 대기 = invites 쿼리 · 재발송/취소 = `/invites` 라우트
- 🟢 조직 상세: 모달 → POST `/api/organizations/[id]/invites` · KPI·탭·필터 칩 "초대 대기" = `GET /invites`(pending 파생) · 승인·초대 탭 대기 행 = 초대 행(email·역할·만료·재발송·취소) · 멤버 테이블 `Pending` 축 제거 · `INVITE_AVAILABLE=true` · 사유 상수 제거. `invites` 라우트: `POST .../invites/[inviteId]/resend`(revoke + 새 토큰 + 메일, 응답 `mailed`) · 메일 템플릿 `lib/email/org-invite-template.ts`. settings/workspace 초대 카드 복원(링크 복사 허용 — 수락 화면이 있으므로 I2 해제)
- 🔵 dead-end-a → `organizations-invite-flow-b.test.ts` 로 승계(역방향: `INVITE_AVAILABLE = false` 부활 RED · members POST 호출 부활 RED) · pairing I1~I3 승계 · honest-member-tab "활성/초대 대기 두 축" → "활성 단일 축 + 초대 대기는 invites" 승계
- ✋ Gate: 승계 센티널 전량 GREEN · dead button 0(모달 발송·재발송·취소 전부 실 라우트) · 메일 실패 시 UI 링크 복사 fallback 노출 확인 · tsc 0
- Rollback: `INVITE_AVAILABLE=false` 1줄(진입점 즉시 재봉인) · 나머지 커밋 revert

### Phase 5: Smoke · Rollout · Rollback (2h)
- Status: [ ] Pending
- 🔴 실패 모드 열거: 로그인 리다이렉트 후 callbackUrl 유실 · 세션 email 대소문자 불일치 · 좌석 초과 경합 · 메일 미도달 · 활성 조직 전환 후 stale 캐시
- 🟢 계정 2개 smoke(prod-like): A 초대 생성 → 링크 → B 로그인 → 미리보기 → 수락 → B 활성 조직 = A 조직 · 권한 판정(use-permission) 반영 · A 화면 초대 대기 0/멤버 +1 · Free 조직 2번째 초대 → 생성 403 · Cowork 배포본 실측(KPI·게이지·탭)
- 🔵 임시 로그 제거 · Notes 확정
- ✋ Gate: smoke 전항 PASS · 롤백 경로 문서화 · 잔여 blocker 격리(3a 후속 트랙 카드 작성)
- Rollback: UI `INVITE_AVAILABLE=false` · accept 라우트 `INVITE_ACCEPT_ENABLED` env 스위치(false → 503 + 안내) · 컬럼은 nullable 로 유지 무해

## 8. Optional Addenda

### A. Workflow / Ontology — 활성 조직 resolver
- Input: `userId` · optional hint(요청 body/query `organizationId`)
- Output: `organizationId | null`
- Rule: hint 가 있고 멤버십 검증 통과 → hint / 없으면 `User.activeOrganizationId`(멤버십 검증) / 없으면 createdAt asc 첫 멤버십 / 조직 0 → null(호출자가 403·빈 상태 처리)
- Validation: [ ] 단일 조직 사용자 결과 불변 [ ] 2중 소속 사용자 switcher 전환 후 API 결과 일치 [ ] 탈퇴 조직 가리키는 stale 값 fallback

### B. Billing / Entitlement — 좌석 게이트
- 상태: `members.count < maxMembers` → 허용 / `>=` → 403 `SEAT_LIMIT` / `maxMembers === null` → 무제한
- Validation: [ ] FREE 1/1 에서 초대 생성 403 [ ] TEAM 3/3 수락 403 [ ] ORGANIZATION 제한 0 [ ] 게이지 `seatOver` 는 여전히 초과에만 앰버(39c8ff22 유지)

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| Phase 2 치환 35곳 회귀 | Med | High | 파일별 커밋 · 인벤토리 센티널 · 단일 조직 사용자 행동 불변 실측 |
| 수락이 Phase 2 전에 배포 | Low | High | 계획 상단 ⛔ + Phase 3 gate 에 "배포 금지" 명시 |
| 좌석 초과 경합(동시 수락) | Low | Med | 수락 트랜잭션 안에서 count 재확인 |
| 메일 미도달을 성공으로 표시 | Med | Med | 응답 `mailed` 필드 · UI 링크 복사 fallback · 거짓 "발송 완료" 센티널 |
| 3a 잔존 개인 조직 혼란 | Med | Low | 활성 = 초대 조직으로 설정 · 후속 트랙 카드 |
| email 지정 초대 + 다른 계정 로그인 | Med | Low | 403 화면에 "초대받은 이메일로 로그인" 안내 |

## 10. Rollback Strategy

- Phase 1 실패: migration down · 신규 4파일 삭제
- Phase 2 실패: 해당 파일 커밋 revert(독립)
- Phase 3 실패: 라우트·페이지 삭제(컬럼 유지)
- Phase 4 실패: `INVITE_AVAILABLE=false` 1줄로 즉시 재봉인 → 나머지 revert
- Phase 5 실패: `INVITE_ACCEPT_ENABLED=false` env → 수락 503 + UI 재봉인

## 11. Progress Tracking

- Overall: ~40%
- Current phase: Phase 2 (7/37 이관 · 다음: organization-vendors 4 → 나머지 API 12 → UI 잔여 13 → switcher PATCH 배선)
- Current blocker: 없음 (prod migrate 적용 확인 완료 2026-09-01)
- Next validation step: organization-vendors 4곳 치환 → 래칫 API 16 → 12 → 전량 축 재실측

- [x] Phase 0 · [x] Phase 1 · [ ] Phase 2 · [ ] Phase 3 · [ ] Phase 4 · [ ] Phase 5

## 12. Notes & Learnings

**Blockers Encountered:**
- (없음)

**Implementation Notes:**
- 2026-08-31 계획 수립. a(`c1f2d867`) 로 진입점 봉인 후 착수. 3a 자동 조직 생략은 별건 후속 트랙.
- 2026-08-31 Phase 1: 인벤토리 센티널을 `toEqual([])` → **파일별 상한 래칫**으로 교체(수용).
  근거 — 원안은 Phase 2 전 구간 상시 RED 라 그사이 섞여 든 신규 위반을 가린다. 래칫은
  baseline GREEN 을 유지하면서 신규 우회로만 즉시 RED 로 잡고, 상한이 0 이 되는 순간
  원안과 같은 게이트가 된다. 키는 파일 단위(줄 번호는 Phase 2 편집으로 오탐).
- 2026-08-31 Phase 1: `vercel-migrate.js` 가 ADR-002 §11.13 로 **영구 NO-OP** 임을 실측.
  "배포 체인이 마이그레이션을 적용한다" 는 전제는 틀렸다 — rollout 은 push → 배포 →
  **operator `migrate deploy`** → health 4스텝이다. 로컬 DB 는 없다(DATABASE_URL = Supabase)
  이므로 "로컬 적용" 이라는 선택지 자체가 성립하지 않고, 이 DDL 은 prod 변경 = 사전 승인 대상.
