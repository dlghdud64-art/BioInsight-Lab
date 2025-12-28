import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  items: z.array(z.any()),
});

/**
 * GET /api/templates
 * Get all templates
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Fetch from database
    // Mock response
    const templates = [
      {
        id: "template-1",
        name: "Cell Culture Basic",
        description: "기본 세포 배양 실험에 필요한 시약 및 소모품",
        category: "Cell Culture",
        itemCount: 8,
        items: [
          { name: "PBS Buffer", quantity: 500, unit: "ml" },
          { name: "Trypsin-EDTA", quantity: 100, unit: "ml" },
          { name: "FBS", quantity: 500, unit: "ml" },
          { name: "DMEM Media", quantity: 500, unit: "ml" },
          { name: "Penicillin-Streptomycin", quantity: 100, unit: "ml" },
          { name: "Cell Culture Flask T75", quantity: 10, unit: "ea" },
          { name: "15ml Conical Tube", quantity: 50, unit: "ea" },
          { name: "50ml Conical Tube", quantity: 50, unit: "ea" },
        ],
        createdAt: "2024-01-15T10:00:00.000Z",
      },
      {
        id: "template-2",
        name: "PCR Experiment",
        description: "PCR 실험을 위한 필수 시약 및 소모품",
        category: "Molecular Biology",
        itemCount: 6,
        items: [
          { name: "Taq Polymerase", quantity: 100, unit: "U" },
          { name: "dNTP Mix", quantity: 1, unit: "ml" },
          { name: "PCR Buffer 10X", quantity: 5, unit: "ml" },
          { name: "Primer Set", quantity: 2, unit: "set" },
          { name: "PCR Tubes 0.2ml", quantity: 1000, unit: "ea" },
          { name: "Agarose", quantity: 100, unit: "g" },
        ],
        createdAt: "2024-01-20T14:30:00.000Z",
      },
      {
        id: "template-3",
        name: "Western Blot",
        description: "Western blot 실험을 위한 완전한 구성",
        category: "Protein Analysis",
        itemCount: 12,
        items: [
          { name: "RIPA Buffer", quantity: 100, unit: "ml" },
          { name: "Protein Marker", quantity: 1, unit: "set" },
          { name: "SDS-PAGE Gel", quantity: 10, unit: "ea" },
          { name: "Transfer Buffer", quantity: 1, unit: "L" },
          { name: "PVDF Membrane", quantity: 10, unit: "sheets" },
          { name: "Blocking Buffer", quantity: 500, unit: "ml" },
        ],
        createdAt: "2024-02-01T09:15:00.000Z",
      },
    ];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("[Templates] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, items } = templateSchema.parse(body);

    console.log("[Templates] Creating template:", name, items.length, "items");

    // TODO: Save to database
    const template = {
      id: `template-${Date.now()}`,
      name,
      description,
      category,
      itemCount: items.length,
      items,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Templates] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
