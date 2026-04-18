import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { leaveOrganization } from "@/lib/api/organizations";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// ì¡°ì§ íí´
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'organization',
      targetEntityId: id,
      sourceSurface: 'organization-leave-api',
      routePath: '/api/organizations/[id]/leave',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await leaveOrganization(id, session.user.id);

    enforcement.complete({});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error leaving organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to leave organization" },
      { status: 500 }
    );
  }
}
