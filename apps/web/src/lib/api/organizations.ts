import { db } from "@/lib/db";
import type { OrganizationRole } from "@/types";
import { Prisma } from "@prisma/client";
import { generateUniqueWorkspaceSlug } from "@/lib/workspace/slug";

// 사용자가 속한 조직 목록 조회
export async function getOrganizationsByUser(userId: string) {
  return db.organization.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          quotes: true,
          members: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

// 조직 상세 조회
export async function getOrganizationById(id: string, userId?: string) {
  return await db.organization.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          quotes: true,
          members: true,
        },
      },
    },
  });
}

// 조직에서 나가기
export async function leaveOrganization(organizationId: string, userId: string) {
  return await db.organizationMember.deleteMany({
    where: {
      organizationId,
      userId,
    },
  });
}

// 조직 유형 옵션 (프론트와 동기화)
export const ORGANIZATION_TYPE_OPTIONS = [
  "R&D 연구소",
  "QC/QA 품질관리",
  "시험·검사 기관",
  "대학 연구실",
  "기타",
] as const;

/**
 * 조직 생성 (옵션 B: Organization ↔ Workspace 1:1 bootstrap)
 *
 * 단일 트랜잭션 안에서 다음을 모두 수행한다:
 *  1) Organization 생성
 *  2) 생성자를 OrganizationMember(ADMIN)로 등록
 *  3) 같은 이름의 Workspace 를 slug 중복 회피 후 생성
 *  4) 생성자를 WorkspaceMember(ADMIN)로 등록
 *
 * 어느 하나라도 실패하면 전체 롤백되므로, "조직만 있고 워크스페이스 없는" 상태가
 * 새로 만들어지지 않는다. 기존 레코드는 scripts/backfill-organization-workspace.ts
 * 로 1회 정리한다.
 *
 * DB 스키마 일부가 아직 최신이 아닌 환경(개발 초기 / 마이그레이션 미적용)을 고려해
 * Organization 컬럼 쓰기는 여전히 방어적 재시도 경로를 유지한다. Workspace 단계는
 * 마이그레이션이 반드시 적용된 환경에서만 호출되므로 단일 경로로 실행한다.
 */
export async function createOrganization(
  userId: string,
  data: {
    name: string;
    description?: string;
    organizationType?: string;
  }
) {
  const orgCreatePayloads = [
    { name: data.name, description: data.description, organizationType: data.organizationType ?? null, plan: "FREE" },
    { name: data.name, description: data.description, organizationType: data.organizationType ?? null },
    { name: data.name, description: data.description ?? null },
    { name: data.name },
  ];

  return await db.$transaction(async (tx) => {
    // 1) Organization 생성 — DB 스키마 변동성 대비 방어적 재시도
    let organization: Prisma.OrganizationGetPayload<{}> | null = null;
    for (const attempt of orgCreatePayloads) {
      try {
        organization = await tx.organization.create({ data: attempt as Prisma.OrganizationCreateInput });
        break;
      } catch (err: any) {
        console.warn(
          "[createOrganization] attempt failed:",
          Object.keys(attempt).join(","),
          err?.message?.slice(0, 120),
        );
        if (attempt === orgCreatePayloads[orgCreatePayloads.length - 1]) throw err;
      }
    }
    if (!organization) {
      // 위 루프에서 반드시 생성 or throw 되지만, 타입 가드 목적.
      throw new Error("Organization 생성 실패: 모든 시도 경로가 실패했습니다.");
    }

    // 2) 생성자 → Organization ADMIN
    await tx.organizationMember.upsert({
      where: {
        userId_organizationId: { userId, organizationId: organization.id },
      },
      update: { role: "ADMIN" },
      create: {
        organizationId: organization.id,
        userId,
        role: "ADMIN",
      },
    });

    // 3) Workspace 자동 생성 (옵션 B 핵심)
    //    slug 는 조직명 정규화 → 충돌 시 suffix. 같은 트랜잭션 안에서 조회해야
    //    동시성 문제를 최소화할 수 있다.
    const workspaceSlug = await generateUniqueWorkspaceSlug(tx, organization.name);
    await tx.workspace.create({
      data: {
        name: organization.name,
        slug: workspaceSlug,
        plan: "FREE",
        // Phase 1: nullable 이지만 신규 생성 경로는 항상 채운다.
        // Phase 2 마이그레이션 후에는 NOT NULL 이 강제된다.
        organizationId: organization.id,
        members: {
          create: { userId, role: "ADMIN" },
        },
      },
    });

    // 4) 응답: 멤버 포함 Organization (subscription relation 은 DB 에 없을 수 있어 제외)
    return await tx.organization.findUnique({
      where: { id: organization.id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });
  });
}

// 조직 정보 업데이트
export async function updateOrganization(
  organizationId: string,
  data: {
    name?: string;
    description?: string;
    slug?: string | null;
    logoUrl?: string | null;
  }
) {
  return await db.organization.update({
    where: { id: organizationId },
    data,
  });
}
