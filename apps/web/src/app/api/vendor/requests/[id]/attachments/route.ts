import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/vendor/requests/[id]/attachments
 * Upload attachment for vendor response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    console.log("Uploading attachment for request:", id);
    console.log("File:", file.name, file.size);

    // TODO: Implement actual logic
    // 1. Validate file type/size
    // 2. Upload to storage (S3, Vercel Blob, etc.)
    // 3. Save reference to DB
    // 4. Return attachment info

    return NextResponse.json({
      success: true,
      attachment: {
        id: `att-${Date.now()}`,
        filename: file.name,
        url: `/uploads/${file.name}`,
      },
    });
  } catch (error) {
    console.error("Upload attachment error:", error);
    return NextResponse.json(
      { error: "Failed to upload attachment" },
      { status: 500 }
    );
  }
}

