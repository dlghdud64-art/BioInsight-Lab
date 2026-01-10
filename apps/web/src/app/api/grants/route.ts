import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { auth } from "@/auth";

const logger = createLogger("grants");

// Grant creation schema
const CreateGrantSchema = z.object({
  teamId: z.string().optional(),
  name: z.string().min(1, "과제명 필수"),
  totalAmount: z.number().int().positive("총 예산은 양수여야 함"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

/**
 * POST /api/grants
 * 연구비 과제 등록
 *
 * 핵심:
 * - totalAmount를 입력받아 remainingAmount도 동일하게 초기화
 * - 팀(Team) 연결 (선택적)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // 요청 검증
    const data = CreateGrantSchema.parse(body);

    logger.info(`Creating grant: ${data.name} with budget ${data.totalAmount}`);

    // Grant 생성
    const grant = await db.grant.create({
      data: {
        teamId: data.teamId || null,
        name: data.name,
        totalAmount: data.totalAmount,
        remainingAmount: data.totalAmount, // 초기에는 총 예산과 동일
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        description: data.description || null,
        isActive: true,
      },
      include: {
        team: true,
      },
    });

    logger.info(`Grant created successfully: ${grant.id}`);

    return NextResponse.json({
      success: true,
      grant,
    });
  } catch (error) {
    return handleApiError(error, "grants/POST");
  }
}

/**
 * GET /api/grants
 * 우리 랩의 과제 목록 및 잔액 조회
 *
 * Query params:
 * - teamId (optional): 특정 팀의 과제만 조회
 * - activeOnly (optional): 활성 과제만 조회 (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const activeOnly = searchParams.get("activeOnly") !== "false"; // default true

    logger.info(`Fetching grants - teamId: ${teamId}, activeOnly: ${activeOnly}`);

    // WHERE 조건 구성
    const where: any = {};
    if (teamId) {
      where.teamId = teamId;
    }
    if (activeOnly) {
      where.isActive = true;
    }

    // Grants 조회
    const grants = await db.grant.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            orders: true, // 이 과제로 구매한 주문 개수
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 통계 계산
    const totalBudget = grants.reduce((sum: number, g) => sum + g.totalAmount, 0);
    const totalRemaining = grants.reduce((sum: number, g) => sum + g.remainingAmount, 0);
    const totalUsed = totalBudget - totalRemaining;

    logger.info(`Found ${grants.length} grants - Total: ${totalBudget}, Used: ${totalUsed}, Remaining: ${totalRemaining}`);

    return NextResponse.json({
      grants,
      summary: {
        totalGrants: grants.length,
        totalBudget,
        totalUsed,
        totalRemaining,
      },
    });
  } catch (error) {
    return handleApiError(error, "grants/GET");
  }
}
