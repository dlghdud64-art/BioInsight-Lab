/**
 * 간단한 로거 유틸리티
 * 프로덕션에서는 적절한 로깅 서비스로 교체 가능
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

class Logger {
  private formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  info(message: string, data?: unknown): void {
    const entry = this.formatLog("info", message, data);
    console.log(`[INFO] ${entry.timestamp} ${message}`, data || "");
  }

  warn(message: string, data?: unknown): void {
    const entry = this.formatLog("warn", message, data);
    console.warn(`[WARN] ${entry.timestamp} ${message}`, data || "");
  }

  error(message: string, error?: unknown): void {
    const entry = this.formatLog("error", message, error);
    console.error(`[ERROR] ${entry.timestamp} ${message}`, error || "");
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === "development") {
      const entry = this.formatLog("debug", message, data);
      console.debug(`[DEBUG] ${entry.timestamp} ${message}`, data || "");
    }
  }
}

export const logger = new Logger();









