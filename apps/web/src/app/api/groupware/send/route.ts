import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendToGroupware } from "@/lib/groupware/integration";
import type { GroupwareConfig, GroupwarePayload } from "@/lib/groupware/integration";

/**
 * 그룹웨어로 데이터 전송 API
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { config, payload }: { config: GroupwareConfig; payload: GroupwarePayload } = body;

    if (!config || !payload) {
      return NextResponse.json(
        { error: "config and payload are required" },
        { status: 400 }
      );
    }

    // 그룹웨어로 데이터 전송
    const result = await sendToGroupware(config, payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, data: result.data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    console.error("Error sending to groupware:", error);
    return NextResponse.json(
      { error: "Failed to send to groupware", message: error.message },
      { status: 500 }
    );
  }
}

