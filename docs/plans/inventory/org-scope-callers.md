# §invite-flow Phase 0 — org-scope 호출자 인벤토리 (정답지)

- **실측:** 2026-08-31 · origin/main `ce14fa84` 워킹트리 · 클로드코드 세션
- **판별기:** `organizationMember.findFirst` 전수(136곳, `__tests__` 제외) 중 **where 절 brace 매칭**으로
  `organizationId` 부재만 선별. ⚠️ 라인 창 휴리스틱은 2회 오판했다 — ① `select: { organizationId }` 를
  where 로 오인(과소 7), ② where 닫힌 뒤 `userOrg.organizationId` 사용을 where 로 오인(budget/predict:26 누락).
  재실측 시 반드시 where 절 경계 안만 본다.
- **축 선언 (fixture 지위):** 아래 `파일:줄` 목록이 **정본 필드**다 — Phase 2 치환 범위와
  `org-scope-callers-inventory.test.ts` 센티널의 정답지. 원문 스니펫 열은 **작업지시 필드**(위치 서술)로,
  치환 후 stale 이 정상 종료 상태다. 갱신·삭제·검사 금지(구 문자열은 역계약 승계 재료).
- **제외 (치환 대상 아님):** SCOPED 114곳 — `where: { userId, organizationId }` 형태의 **hint 검증 패턴**
  (명시 organizationId 의 멤버십 확인). 이는 resolver 의 hint 검증과 동일 의미라 Phase 2 에서 강제 이관하지
  않는다(원하면 개별 판단).

## A. API 축 — unscoped `findFirst({ where: { userId } })` · 22곳

| # | 파일:줄 | 원문(작업지시 — 갱신 금지) |
|---|---------|---------------------------|
| 1 | `apps/web/src/app/api/activity-logs/route.ts:174` | `const userOrg = …findFirst({ where: { userId: session.user.id }, select: { organizationId…` |
| 2 | `apps/web/src/app/api/analytics/dashboard/route.ts:46` | `const userOrg = …findFirst({ where: { userId }, select: { organizationId: true } })` |
| 3 | `apps/web/src/app/api/billing/invoices/route.ts:67` | `const membership = …findFirst({ where: { userId: session.user.id }, include: { orga…` |
| 4 | `apps/web/src/app/api/billing/payment-methods/route.ts:23` | `const membership = …findFirst({ where: { userId: session.user.id }, include: …` |
| 5 | `apps/web/src/app/api/billing/payment-methods/route.ts:93` | 〃 |
| 6 | `apps/web/src/app/api/billing/payment-methods/route.ts:184` | 〃 |
| 7 | `apps/web/src/app/api/billing/route.ts:110` | `const membership = …findFirst({ where: { userId }, include: { organization: …` |
| 8 | `apps/web/src/app/api/billing/route.ts:242` | `const membership = …findFirst({ where: { userId: session.user.id }, include: …` |
| 9 | `apps/web/src/app/api/budget/predict/route.ts:26` | `const userOrg = …findFirst({ where: { userId: session.user.id } }); scopeKey = …` |
| 10 | `apps/web/src/app/api/budget/report/route.ts:40` | `const userOrg = …findFirst({ where: { userId: session.user.id }, include: { organiz…` |
| 11 | `apps/web/src/app/api/budgets/route.ts:174` | `const membership = …findFirst({ where: { userId: session.user.id }, select: { organ…` |
| 12 | `apps/web/src/app/api/data-audit-logs/route.ts:60` | `const firstMembership = …findFirst({ where: { userId: session.user.id }, select: …` |
| 13 | `apps/web/src/app/api/organization-vendor-products/[id]/route.ts:29` | `…findFirst({ where: { userId }, select: { organizationId: true }, orderBy: { createdAt: "asc" } })` |
| 14 | `apps/web/src/app/api/organization-vendor-products/route.ts:39` | 〃 |
| 15 | `apps/web/src/app/api/organization-vendors/[id]/route.ts:41` | 〃 |
| 16 | `apps/web/src/app/api/organization-vendors/route.ts:45` | 〃 |
| 17 | `apps/web/src/app/api/protocol/extract-pdf/route.ts:207` | `const membership = …findFirst({ where: { userId: session.user.id }, select: { organ…` |
| 18 | `apps/web/src/app/api/quotes/route.ts:99` | `const firstMembership = …findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc"…` — hint 검증(§92 SCOPED) 실패 시 fallback |
| 19 | `apps/web/src/app/api/recommendations/personalized/route.ts:104` | `const userOrg = …findFirst({ where: { userId: session.user.id }, select: { organiza…` |
| 20 | `apps/web/src/app/api/recommendations/purchase-patterns/route.ts:21` | 〃 |
| 21 | `apps/web/src/app/api/team/route.ts:118` | `…findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } })` — createdAt asc 결정론화 + "초대 살아나면 거처를 읽도록" 주석. **resolver fallback 규칙의 원본** |
| 22 | `apps/web/src/lib/billing/enforce-plan-limit.ts:45` | `const membership = …findFirst({ where: { userId }, select: { organization: { select…` |

계열 요약: billing 6 · organization-vendors/-products 4 · budget/budgets 3 · recommendations 2 ·
activity/data-audit/analytics/quotes/protocol/team/enforce-plan-limit 각 1.

## B. UI 축 — `orgs[0] | organizations[0] | memberships[0]` · 17곳 / 13파일 (코드 15 · 주석 2)

| # | 파일:줄 | 지위 | 원문(작업지시 — 갱신 금지) |
|---|---------|------|---------------------------|
| 1 | `apps/web/src/hooks/use-permission.ts:93` | 코드 | `return orgs[0]!` — **권한 판정이 첫 조직 기준. Phase 2 최우선** |
| 2 | `apps/web/src/components/workspace/workspace-switcher.tsx:81` | 코드 | `setSelectedOrgId(organizations[0].id)` |
| 3 | `apps/web/src/components/workspace/workspace-switcher.tsx:109` | 코드 | `value={selectedOrgId \|\| currentOrganizationId \|\| organizations[0]?.id \|\| ""}` |
| 4 | `apps/web/src/components/inventory/BulkImportModal.tsx:101` | 코드 | `const organizationId = adminOrg?.id ?? organizations[0]?.id` |
| 5 | `apps/web/src/app/admin/safety/page.tsx:77` | 코드 | `) \|\| organizations[0]` |
| 6 | `apps/web/src/app/dashboard/organizations/page.tsx:326` | 코드 | `const role = organizations[0].role` |
| 7 | `apps/web/src/app/dashboard/organizations/page.tsx:328` | 코드 | `router.replace(\`/dashboard/organizations/${organizations[0].id}\`)` |
| 8 | `apps/web/src/app/dashboard/safety-spend/page.tsx:94` | 코드 | `) \|\| organizations[0]` |
| 9 | `apps/web/src/app/dashboard/settings/enterprise/page.tsx:45` | 코드 | `: organizations[0]` |
| 10 | `apps/web/src/app/dashboard/settings/plans/page.tsx:366` | 코드 | `setSelectedOrgId(organizations[0].id)` |
| 11 | `apps/web/src/app/dashboard/settings/plans/page.tsx:372` | 코드 | `: organizations[0] ?? null` |
| 12 | `apps/web/src/app/settings/audit/page.tsx:71` | 코드 | `) \|\| organizations[0]` |
| 13 | `apps/web/src/app/settings/billing/page.tsx:47` | 코드 | `) \|\| organizations[0]` |
| 14 | `apps/web/src/app/settings/security/page.tsx:47` | 코드 | `) \|\| organizations[0]` |
| 15 | `apps/web/src/app/settings/workspace/page.tsx:68` | 코드 | `) \|\| organizations[0]` |
| 16 | `apps/web/src/app/settings/workspace/page.tsx:596` | **주석** | `(다중 소속 데이터가 생기는 순간 orgs[0]·findFirst 오선택)` — 치환 대상 아님, Phase 2 종료 시 문구만 현행화 |
| 17 | `apps/web/src/app/api/team/route.ts:112` | **주석** | `바꿔야 한다. 그때까지는 \`orgs[0]\` 이 아니라 …` — API 파일 내 서술. A-21 이관 시 문구만 현행화 |

⚠️ 계획서 §0 의 "UI 17곳/13파일" 은 grep 원계수다 — **치환 대상 코드는 15곳/12파일**이고
2곳은 주석(서술 축)이다. CLAUDE.md "grep 전량을 갱신 대상으로 쓰지 말 것" 조항 그대로.
센티널(`org-scope-callers-inventory.test.ts`)의 UI 축 부정 단언은 **주석 제거본**에 건다.

## 총계

- **API 22 · UI 코드 15 (주석 2 별도) = 치환 39곳** (계획서 "39곳" 과 일치: API 22 + UI 17 원계수 기준.
  Phase 2 집행 기준은 코드 37 + 주석 문구 현행화 2)
- Phase 2 완료 조건: 위 A 전부 `resolveActiveOrganizationId` 경유 · B 코드 전부 `useActiveOrganization()` 경유 ·
  인벤토리 센티널 GREEN(직접 호출 0)
