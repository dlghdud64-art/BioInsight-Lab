import { NextRequest, NextResponse } from "next/server";
import { generateTemplateExcel } from "@/lib/export/excel-generator";

/**
 * GET /api/templates/:id/export
 * Export template to Excel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    console.log("[Template Export] Exporting template:", id);

    // TODO: Fetch template from database
    // Mock template data
    const template = {
      id,
      name: "Cell Culture Basic",
      items: [
        { name: "PBS Buffer", category: "시약", quantity: 500, unit: "ml", specification: "pH 7.4" },
        { name: "Trypsin-EDTA", category: "시약", quantity: 100, unit: "ml", specification: "0.25%" },
        { name: "FBS", category: "시약", quantity: 500, unit: "ml", specification: "Heat Inactivated" },
        { name: "DMEM Media", category: "시약", quantity: 500, unit: "ml", specification: "High Glucose" },
      ],
    };

    // Generate Excel file
    const excelBuffer = await generateTemplateExcel(template.items);

    // Return as download
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_${template.name}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[Template Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export template" },
      { status: 500 }
    );
  }
}

