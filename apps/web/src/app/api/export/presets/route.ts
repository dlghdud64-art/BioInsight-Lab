import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const presetSchema = z.object({
  name: z.string().min(1),
  mappings: z.array(
    z.object({
      id: z.string(),
      erpColumnName: z.string(),
      appDataField: z.string(),
    })
  ),
});

/**
 * POST /api/export/presets
 * Save export preset
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_export',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/export/presets',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { name, mappings } = presetSchema.parse(body);

    console.log("[Export Preset] Saving preset:", name, mappings.length, "mappings");

    // TODO: Save to database
    // Mock response
    const preset = {
      id: `preset-${Date.now()}`,
      name,
      mappings,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(preset);
  } catch (error) {
    console.error("[Export Preset] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save preset" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/export/presets
 * Get all export presets
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch from database
    // Mock response
    const presets = [
      {
        id: "preset-1",
        name: "SAP 양식",
        mappings: [
          { id: "1", erpColumnName: "SAP Code", appDataField: "catalogNumber" },
          { id: "2", erpColumnName: "Material Name", appDataField: "productName" },
          { id: "3", erpColumnName: "Vendor Code", appDataField: "vendor" },
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: "preset-2",
        name: "Oracle ERP 양식",
        mappings: [
          { id: "1", erpColumnName: "Item Number", appDataField: "catalogNumber" },
          { id: "2", erpColumnName: "Description", appDataField: "productName" },
          { id: "3", erpColumnName: "Unit Price", appDataField: "price" },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    return NextResponse.json({ presets });
  } catch (error) {
    console.error("[Export Preset] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    );
  }
}

