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