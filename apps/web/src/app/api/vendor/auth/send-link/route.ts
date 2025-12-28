import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const sendLinkSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/vendor/auth/send-link
 * Send magic login link to vendor email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = sendLinkSchema.parse(body);

    // TODO: Implement actual logic
    // 1. Generate magic link token
    // 2. Store token in DB with expiry (24h)
    // 3. Send email with link
    // 4. Link format: /vendor/auth/verify?token={token}

    console.log("Sending login link to:", email);

    return NextResponse.json({
      success: true,
      message: "Login link sent",
    });
  } catch (error) {
    console.error("Send link error:", error);
    return NextResponse.json(
      { error: "Failed to send login link" },
      { status: 500 }
    );
  }
}

