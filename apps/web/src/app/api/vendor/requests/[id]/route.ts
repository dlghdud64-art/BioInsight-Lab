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
      quoteTitle: "Cell Culture 시약 견적",
      requesterName: "김연구",
      organizationName: "서울대학교 생명과학연구소",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: [
        {
          id: "item-1",
          productName: "DMEM (Dulbecco's Modified Eagle Medium)",
          catalogNumber: "11965092",
          quantity: 10,
          unit: "bottle",
          specification: "High Glucose, with L-Glutamine",
        },
        {
          id: "item-2",
          productName: "Fetal Bovine Serum (FBS)",
          catalogNumber: "10270106",
          quantity: 5,
          unit: "bottle",
          specification: "Heat Inactivated, 500ml",
        },
        {
          id: "item-3",
          productName: "Trypsin-EDTA (0.25%)",
          catalogNumber: "25200056",
          quantity: 20,
          unit: "bottle",
          specification: "Phenol Red, 100ml",
        },
        {
          id: "item-4",
          productName: "PBS Buffer",
          catalogNumber: "10010023",
          quantity: 10,
          unit: "bottle",
          specification: "pH 7.4, 500ml",
        },
        {
          id: "item-5",
          productName: "Penicillin-Streptomycin",
          catalogNumber: "15140122",
          quantity: 5,
          unit: "bottle",
          specification: "10,000 U/ml, 100ml",
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

