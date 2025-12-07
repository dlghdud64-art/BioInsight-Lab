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
export async function getOrganizationById(organizationId: string, userId: string) {
  // 사용자가 조직 멤버인지 확인
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
    },
  });

  if (!member) {
    throw new Error("You are not a member of this organization");
  }

  return db.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      quotes: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
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
  const organization = await db.organization.create({
    data: {
      name: data.name,
      description: data.description,
      members: {
        create: {
          userId,
          role: "ADMIN", // 생성자는 자동으로 관리자
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
    },
  });

  return organization;
}

// 조직 정보 수정
export async function updateOrganization(
  organizationId: string,
  userId: string,
  data: {
    name?: string;
    description?: string;
  }
) {
  // 사용자가 조직 관리자인지 확인
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: "ADMIN",
    },
  });

  if (!member) {
    throw new Error("Only organization admins can update organization");
  }

  return db.organization.update({
    where: { id: organizationId },
    data,
  });
}

// 조직 멤버 추가
export async function addOrganizationMember(
  organizationId: string,
  userId: string, // 초대하는 사람
  data: {
    userEmail: string;
    role: OrganizationRole;
  }
) {
  // 사용자가 조직 관리자이거나 APPROVER인지 확인
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: {
        in: ["ADMIN", "APPROVER"],
      },
    },
  });

  if (!member) {
    throw new Error("You don't have permission to add members");
  }

  // 초대할 사용자 찾기
  const targetUser = await db.user.findUnique({
    where: { email: data.userEmail },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  // 이미 멤버인지 확인
  const existingMember = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId: targetUser.id,
    },
  });

  if (existingMember) {
    throw new Error("User is already a member");
  }

  return db.organizationMember.create({
    data: {
      organizationId,
      userId: targetUser.id,
      role: data.role,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

// 조직 멤버 역할 변경
export async function updateOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  userId: string, // 변경하는 사람
  role: OrganizationRole
) {
  // 사용자가 조직 관리자인지 확인
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: "ADMIN",
    },
  });

  if (!member) {
    throw new Error("Only organization admins can update member roles");
  }

  return db.organizationMember.update({
    where: { id: memberId },
    data: { role },
  });
}

// 조직 멤버 제거
export async function removeOrganizationMember(
  organizationId: string,
  memberId: string,
  userId: string // 제거하는 사람
) {
  // 사용자가 조직 관리자인지 확인
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: "ADMIN",
    },
  });

  if (!member) {
    throw new Error("Only organization admins can remove members");
  }

  // 자기 자신을 제거할 수 없음
  const targetMember = await db.organizationMember.findUnique({
    where: { id: memberId },
  });

  if (targetMember?.userId === userId) {
    throw new Error("You cannot remove yourself");
  }

  return db.organizationMember.delete({
    where: { id: memberId },
  });
}

// 조직 탈퇴
export async function leaveOrganization(organizationId: string, userId: string) {
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
    },
  });

  if (!member) {
    throw new Error("You are not a member of this organization");
  }

  // 관리자는 탈퇴할 수 없음 (다른 관리자에게 권한을 넘겨야 함)
  if (member.role === "ADMIN") {
    const adminCount = await db.organizationMember.count({
      where: {
        organizationId,
        role: "ADMIN",
      },
    });

    if (adminCount === 1) {
      throw new Error("You cannot leave as the only admin. Please assign another admin first.");
    }
  }

  return db.organizationMember.delete({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
}



