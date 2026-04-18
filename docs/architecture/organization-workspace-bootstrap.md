# Organization ↔ Workspace Bootstrap 설계 노트

> **상태**: 제안 (Draft) — 2026-04-17
> **관련 이슈**: 신규 가입 유저가 Team/Business 플랜 결제 플로우에 진입하지 못하는 구조적 장애
> **관련 PR 배경**: `workspace_create` 액션 신설로 **1차 잠금 해제**는 적용됨. 본 문서는 **근본 해결** 방향을 기록한다.

## 1. 문제의 본질

현재 제품에는 **서로를 모르는 두 도메인**이 공존한다.

| 항목 | `Organization` | `Workspace` |
|---|---|---|
| 목적 | 바이오 R&D 조직 단위 (랩/회사/센터) | 결제 + 공동작업 단위 (Stripe 구독) |
| 플랜 enum | `SubscriptionPlan` | `WorkspacePlan` (FREE/TEAM/ENTERPRISE) |
| 멤버십 | `OrganizationMember` (`ADMIN`/`VIEWER` 등) | `WorkspaceMember` (`ADMIN`/`MEMBER`) |
| Stripe 필드 | 없음 (별도 `Subscription` 모델) | 모델 내부에 내장 (`stripeSubscriptionId`, `billingStatus` 등) |
| 생성 UI | `/dashboard/organizations` | 사용자 진입점 없음 (API-only) |
| 권한 action | `organization_*` 다수 | `workspace_create`/`workspace_manage` |

사용자는 "조직"만 체감하는데, 결제 레이어는 "워크스페이스"만 본다. 결제 플로우의 `plan-select` resolver는 `db.workspace`/`db.workspaceMember`만 조회하므로, Organization만 있고 Workspace가 없는 신규 가입자는 resolver가 항상 `create_workspace` 분기로 빠지고 실질적으로 결제 진입이 차단된다.

## 2. 1차 조치 (이미 적용됨)

- `IrreversibleActionType`에 `workspace_create` 신설
- `ACTION_ROLE_MINIMUM.workspace_create = ['requester', 'buyer', 'approver', 'ops_admin']`
- `POST /api/workspaces`의 `enforceAction` action을 `workspace_create`로 교체

효과: 프로그래매틱하게 `POST /api/workspaces`를 호출하면 로그인 유저는 누구나 성공한다. 그러나 **사용자 UI에서 Workspace를 생성하는 경로는 여전히 없다**. 따라서 아직 일반 가입자는 결제에 도달하지 못한다.

## 3. 근본 해결 방향 (옵션 B — 본 문서의 제안)

### 3.1 원칙

1. 사용자 멘탈 모델은 **"조직" 하나**로 유지. 워크스페이스라는 개념을 사용자에게 노출하지 않는다.
2. 내부 데이터 모델은 `Organization` 1 ↔ 1 `Workspace` 관계를 강제한다.
3. 결제/멤버십 로직은 기존대로 `Workspace` 기반을 유지한다(Stripe 필드 마이그레이션 부담 회피).

### 3.2 스키마 변경

```prisma
model Workspace {
  id             String   @id @default(cuid())
  organizationId String   @unique   // ← 신설: Organization과 1:1 강제
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  // ... 기존 필드 유지
}

model Organization {
  // ... 기존 필드 유지
  workspace      Workspace?         // 역방향 relation
}
```

- `@unique`로 1:1 enforcement
- `onDelete: Cascade` — Organization 삭제 시 Workspace도 함께 삭제(결제 정리는 별도 훅 필요)

### 3.3 createOrganization 트랜잭션 확장

`apps/web/src/lib/api/organizations.ts`의 `createOrganization`을 다음과 같이 확장:

```ts
export async function createOrganization(userId: string, data: ...) {
  return await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: ... });

    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId, role: "ADMIN" },
    });

    // ↓ 새로 추가: Workspace + WorkspaceMember(ADMIN)
    const workspace = await tx.workspace.create({
      data: {
        organizationId: organization.id,
        name: organization.name,
        slug: await generateUniqueWorkspaceSlug(tx, organization.name),
        plan: "FREE",
        members: {
          create: { userId, role: "ADMIN" },
        },
      },
    });

    return { organization, workspace };
  });
}
```

### 3.4 plan-select resolver 단순화

`resolveCurrentWorkspaceId`는 유지하되, 1:1 관계를 활용해 캐시 힌트로 `organizationId → workspaceId`를 함께 조회 가능. 로직 자체는 큰 변화 불필요.

### 3.5 기존 유저 backfill 전략

1. **발견 쿼리**: Organization이 있으나 Workspace가 없는 `OrganizationMember.role IN ('ADMIN','OWNER')` 목록 추출
2. **마이그레이션 스크립트**: 각 Organization당 Workspace 1개를 `plan=FREE`로 생성, 기존 ADMIN 멤버를 WorkspaceMember(ADMIN)로 복제
3. **Dry-run 모드**: `--dry-run` 플래그로 생성 예정 레코드 수만 출력
4. **되돌리기**: 생성된 Workspace ID를 로그로 남겨서 롤백 스크립트에서 참조 가능하게 함

### 3.6 `workspace_create` 액션의 향후 운명

Organization 생성과 Workspace 생성이 완전히 묶이면, 사용자가 직접 `POST /api/workspaces`를 호출할 이유는 사라진다. 그 시점에 다음을 선택:

- **보수적**: `workspace_create`를 `ops_admin`으로 되돌리고, `POST /api/workspaces`를 내부 전용 엔드포인트로 전환(ops 툴/테스트용)
- **과감**: `POST /api/workspaces`를 deprecate하고 `POST /api/organizations`가 유일한 생성 경로가 되도록 한다

## 4. 제외된 옵션 (기록용)

**옵션 C — plan-select resolver를 Organization 기반으로 전면 재작성**
`Workspace` 모델의 Stripe 필드를 `Organization`에 통합하거나 기존 `Subscription` 모델을 결제 진실원(source of truth)으로 승격. Workspace 도메인 자체를 deprecate. 영향 범위가 Purchase/Budget/Quote 등 여러 기능과 엮여 있어 본 시점에는 부담이 과도하다고 판단.

## 5. 마이그레이션 체크리스트 (옵션 B 실행 시)

- [ ] `Workspace.organizationId` 추가 Prisma 마이그레이션 (nullable로 시작 → backfill 후 NOT NULL + @unique로 승격)
- [ ] `createOrganization` 트랜잭션 확장 + 슬러그 중복 처리
- [ ] `generateUniqueWorkspaceSlug` 유틸 신설
- [ ] `backfill-organization-workspace.ts` 1회성 스크립트 + dry-run/롤백 플래그
- [ ] E2E: 신규 가입 → Organization 생성 → 바로 Team 플랜 결제 플로우 도달 확인
- [ ] 모니터링: `workspace_create` 감사 로그 모니터링해서 "UI 없는 호출" 유입 경로 파악
