import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/requests/[id]
 * Get vendor request detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log("Fetching vendor request:", id);

    // Mock data for now
    const mockRequest = {
      id,
      quoteTitle: "2024 Q1 시약 구매",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [
        {
          id: "item-1",
          productName: "DMEM (Dulbecco's Modified Eagle Medium)",
          catalogNumber: "11965092",
          quantity: 10,
          unitPrice: undefined,
          leadTime: undefined,
          moq: undefined,
          notes: undefined,
        },
        {
          id: "item-2",
          productName: "Fetal Bovine Serum (FBS)",
          catalogNumber: "10270106",
          quantity: 5,
          unitPrice: undefined,
          leadTime: undefined,
          moq: undefined,
          notes: undefined,
        },
        {
          id: "item-3",
          productName: "Trypsin-EDTA (0.25%)",
          catalogNumber: "25200056",
          quantity: 20,
          unitPrice: undefined,
          leadTime: undefined,
          moq: undefined,
          notes: undefined,
        },
      ],
      attachments: [],
      canEdit: true,
    };

    return NextResponse.json({
      request: mockRequest,
    });
  } catch (error) {
    console.error("Fetch vendor request error:", error);
    return NextResponse.json(
      { error: "Failed to fetch request" },
      { status: 500 }
    );
  }
}

