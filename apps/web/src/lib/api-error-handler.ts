import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLogger } from "./logger";

const logger = createLogger("API");

export interface ApiError {
  error: string;
  details?: any;
  code?: string;
}

export function handleApiError(error: unknown, context: string): NextResponse<ApiError> {
  // Zod validation error
  if (error instanceof ZodError) {
    logger.warn(`Validation error in ${context}`, error.errors);
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.errors.map((e: any) => ({
          path: e.path.join("."),
          message: e.message,
        })),
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  // Known error with message
  if (error instanceof Error) {
    const statusCode = getStatusCode(error.message);
    logger.error(`Error in ${context}: ${error.message}`, {
      stack: error.stack,
    });

    return NextResponse.json(
      {
        error: error.message,
        code: error.name,
      },
      { status: statusCode }
    );
  }

  // Unknown error
  logger.error(`Unknown error in ${context}`, error);
  return NextResponse.json(
    {
      error: "Internal server error",
      code: "UNKNOWN_ERROR",
    },
    { status: 500 }
  );
}

function getStatusCode(message: string): number {
  if (message.includes("Unauthorized") || message.includes("required")) {
    return 401;
  }
  if (message.includes("Forbidden") || message.includes("permission")) {
    return 403;
  }
  if (message.includes("not found") || message.includes("Not found")) {
    return 404;
  }
  if (message.includes("already exists") || message.includes("duplicate")) {
    return 409;
  }
  if (message.includes("invalid") || message.includes("Invalid")) {
    return 400;
  }
  return 500;
}
