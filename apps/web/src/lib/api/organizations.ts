import { db } from "@/lib/db";
import type { OrganizationRole } from "@/types";

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

// 조직 생성
export async function createOrganization(
  userId: string,
  data: {
    name: string;
    description?: string;
  }
) {
  return await db.organization.create({
    data: {
      name: data.name,
      description: data.description,
      plan: "FREE",
      members: {
        create: {
          userId,
          role: "ADMIN",
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
  }
) {
  return await db.organization.update({
    where: { id: organizationId },
    data,
  });
}
