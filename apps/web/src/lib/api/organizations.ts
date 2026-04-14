import { db } from "@/lib/db";
import type { OrganizationRole } from "@/types";
import { Prisma } from "@prisma/client";

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

// 조직 생성 (RLS 권한 문제 해결을 위해 트랜잭션 사용)
export async function createOrganization(
  userId: string,
  data: {
    name: string;
    description?: string;
    organizationType?: string;
  }
) {
  // pgbouncer(6543) 환경에서 interactive transaction 미지원 → 순차 처리
  // 1. 조직 생성
  const organization = await db.organization.create({
    data: {
      name: data.name,
      description: data.description,
      organizationType: data.organizationType ?? null,
      plan: "FREE",
    },
  });

  // 2. 생성자를 멤버로 즉시 등록
  await db.organizationMember.upsert({
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

  // 3. 생성된 조직을 멤버 정보와 함께 반환
  return await db.organization.findUnique({
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
      subscription: true,
    },
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
