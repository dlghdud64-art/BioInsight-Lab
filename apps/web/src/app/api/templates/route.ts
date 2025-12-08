import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // R&D, QC, PRODUCTION, CUSTOM
    const organizationId = searchParams.get("organizationId");

    const where: any = {
      OR: [
        { isPublic: true }, // 공개 템플릿
        { userId: session.user.id }, // 사용자 템플릿
      ],
    };

    if (type) {
      where.type = type;
    }

    if (organizationId) {
      where.OR.push({ organizationId });
    }

    const templates = await db.quoteTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      type,
      description,
      columns,
      organizationId,
      isDefault,
      isPublic,
    } = body;

    if (!name || !type || !columns) {
      return NextResponse.json(
        { error: "Name, type, and columns are required" },
        { status: 400 }
      );
    }

    // 기본 템플릿으로 설정하는 경우, 기존 기본 템플릿 해제
    if (isDefault) {
      await db.quoteTemplate.updateMany({
        where: {
          userId: session.user.id,
          type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await db.quoteTemplate.create({
      data: {
        name,
        type,
        description,
        columns,
        userId: session.user.id,
        organizationId,
        isDefault: isDefault || false,
        isPublic: isPublic || false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // R&D, QC, PRODUCTION, CUSTOM
    const organizationId = searchParams.get("organizationId");

    const where: any = {
      OR: [
        { isPublic: true }, // 공개 템플릿
        { userId: session.user.id }, // 사용자 템플릿
      ],
    };

    if (type) {
      where.type = type;
    }

    if (organizationId) {
      where.OR.push({ organizationId });
    }

    const templates = await db.quoteTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      type,
      description,
      columns,
      organizationId,
      isDefault,
      isPublic,
    } = body;

    if (!name || !type || !columns) {
      return NextResponse.json(
        { error: "Name, type, and columns are required" },
        { status: 400 }
      );
    }

    // 기본 템플릿으로 설정하는 경우, 기존 기본 템플릿 해제
    if (isDefault) {
      await db.quoteTemplate.updateMany({
        where: {
          userId: session.user.id,
          type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await db.quoteTemplate.create({
      data: {
        name,
        type,
        description,
        columns,
        userId: session.user.id,
        organizationId,
        isDefault: isDefault || false,
        isPublic: isPublic || false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}



import { auth } from "@/auth";
import { db } from "@/lib/db";

// 템플릿 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // R&D, QC, PRODUCTION, CUSTOM
    const organizationId = searchParams.get("organizationId");

    const where: any = {
      OR: [
        { isPublic: true }, // 공개 템플릿
        { userId: session.user.id }, // 사용자 템플릿
      ],
    };

    if (type) {
      where.type = type;
    }

    if (organizationId) {
      where.OR.push({ organizationId });
    }

    const templates = await db.quoteTemplate.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// 템플릿 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      type,
      description,
      columns,
      organizationId,
      isDefault,
      isPublic,
    } = body;

    if (!name || !type || !columns) {
      return NextResponse.json(
        { error: "Name, type, and columns are required" },
        { status: 400 }
      );
    }

    // 기본 템플릿으로 설정하는 경우, 기존 기본 템플릿 해제
    if (isDefault) {
      await db.quoteTemplate.updateMany({
        where: {
          userId: session.user.id,
          type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await db.quoteTemplate.create({
      data: {
        name,
        type,
        description,
        columns,
        userId: session.user.id,
        organizationId,
        isDefault: isDefault || false,
        isPublic: isPublic || false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}






