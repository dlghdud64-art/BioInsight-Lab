import { getErrorMessage, extractApiErrorMessage, toAppError } from "@/lib/errors";

describe("Error utilities", () => {
  describe("getErrorMessage", () => {
    it("should return error message for Error instance", () => {
      const error = new Error("Test error");
      expect(getErrorMessage(error)).toBe("Test error");
    });

    it("should handle network errors", () => {
      const error = new Error("Network fetch failed");
      expect(getErrorMessage(error)).toContain("네트워크");
    });

    it("should handle timeout errors", () => {
      const error = new Error("Request timeout");
      expect(getErrorMessage(error)).toContain("시간이 초과");
    });

    it("should handle 401 errors", () => {
      const error = new Error("401 Unauthorized");
      expect(getErrorMessage(error)).toContain("로그인");
    });

    it("should handle 403 errors", () => {
      const error = new Error("403 Forbidden");
      expect(getErrorMessage(error)).toContain("권한");
    });

    it("should handle 404 errors", () => {
      const error = new Error("404 Not Found");
      expect(getErrorMessage(error)).toContain("찾을 수 없습니다");
    });

    it("should handle 500 errors", () => {
      const error = new Error("500 Internal Server Error");
      expect(getErrorMessage(error)).toContain("서버");
    });

    it("should handle string errors", () => {
      expect(getErrorMessage("String error")).toBe("String error");
    });

    it("should handle object errors with message", () => {
      const error = { message: "Object error" };
      expect(getErrorMessage(error)).toBe("Object error");
    });

    it("should return default message for unknown errors", () => {
      expect(getErrorMessage(null)).toBe("알 수 없는 오류가 발생했습니다.");
      expect(getErrorMessage(undefined)).toBe("알 수 없는 오류가 발생했습니다.");
      expect(getErrorMessage({})).toBe("알 수 없는 오류가 발생했습니다.");
    });
  });

  describe("extractApiErrorMessage", () => {
    it("should extract error from response data", () => {
      // Response 객체 모킹
      const response = {
        status: 400,
      } as Response;
      const data = { error: "Custom error message" };
      expect(extractApiErrorMessage(response, data)).toBe("Custom error message");
    });

    it("should return status-specific messages", () => {
      const createMockResponse = (status: number) => ({ status } as Response);
      expect(extractApiErrorMessage(createMockResponse(400), {})).toContain("잘못된 요청");
      expect(extractApiErrorMessage(createMockResponse(401), {})).toContain("로그인");
      expect(extractApiErrorMessage(createMockResponse(403), {})).toContain("권한");
      expect(extractApiErrorMessage(createMockResponse(404), {})).toContain("찾을 수 없습니다");
      expect(extractApiErrorMessage(createMockResponse(429), {})).toContain("너무 많습니다");
      expect(extractApiErrorMessage(createMockResponse(500), {})).toContain("서버");
      expect(extractApiErrorMessage(createMockResponse(503), {})).toContain("일시적으로");
    });
  });

  describe("toAppError", () => {
    it("should convert Error to AppError", () => {
      const error = new Error("Test error");
      const appError = toAppError(error);
      expect(appError.message).toBe("Test error");
      expect(appError.code).toBe("Error");
      expect(appError.details).toBeDefined();
    });

    it("should handle object errors", () => {
      const error = { message: "Object error", code: "CUSTOM_CODE", statusCode: 400 };
      const appError = toAppError(error);
      expect(appError.message).toBe("Object error");
      expect(appError.code).toBe("CUSTOM_CODE");
      expect(appError.statusCode).toBe(400);
    });
  });
});

