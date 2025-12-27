type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEvent {
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const event: LogEvent = {
      level,
      message,
      context: this.context,
      data,
      timestamp: new Date().toISOString(),
    };

    const prefix = `[${event.timestamp}] [${level.toUpperCase()}]${
      this.context ? ` [${this.context}]` : ""
    }`;

    switch (level) {
      case "error":
        console.error(prefix, message, data || "");
        break;
      case "warn":
        console.warn(prefix, message, data || "");
        break;
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.log(prefix, message, data || "");
        }
        break;
      default:
        console.log(prefix, message, data || "");
    }
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export const logger = new Logger();
