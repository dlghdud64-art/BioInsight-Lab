import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { logger } from "./logger";

/**
 * API 에러 처리 헬퍼
 * handleApiError 표준으로 통일
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  const errorContext = context ? `[${context}]` : "";
  
  if (error instanceof ZodError) {
    logger.error(`${errorContext} Validation error:`, error.errors);
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    logger.error(`${errorContext} Error:`, error.message, error.stack);
    
    // 인증 에러
    if (error.message.includes("Unauthorized") || error.message.includes("401")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // 권한 에러
    if (error.message.includes("Forbidden") || error.message.includes("403")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    // 찾을 수 없음
    if (error.message.includes("Not Found") || error.message.includes("404")) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }

  logger.error(`${errorContext} Unknown error:`, error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

/**
 * JSON body 검증 (Zod)
 */
export async function validateJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: handleApiError(error, "validateJsonBody"),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      ),
    };
  }
}

/**
 * Search params 검증 (Zod)
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: handleApiError(error, "validateSearchParams"),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: "Invalid search params" },
        { status: 400 }
      ),
    };
  }
}









