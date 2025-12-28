import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/templates/:id
 * Get template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // TODO: Fetch from database
    // Mock response
    const template = {
      id,
      name: "Cell Culture Basic",
      description: "기본 세포 배양 실험에 필요한 시약 및 소모품",
      category: "Cell Culture",
      itemCount: 8,
      items: [
        { name: "PBS Buffer", quantity: 500, unit: "ml" },
        { name: "Trypsin-EDTA", quantity: 100, unit: "ml" },
      ],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Template] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:id
 * Delete template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    console.log("[Template] Deleting template:", id);

    // TODO: Delete from database

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Template] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
