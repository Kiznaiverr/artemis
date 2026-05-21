type LogLevel = "error" | "warn" | "info" | "debug";

const COLOR_RESET = "\x1b[0m";
const COLORS: Record<LogLevel, string> = {
  error: "\x1b[31m",
  warn: "\x1b[33m",
  info: "\x1b[36m",
  debug: "\x1b[90m",
};
const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function normalizeLevel(value: string | undefined): LogLevel {
  if (
    value === "error" ||
    value === "warn" ||
    value === "info" ||
    value === "debug"
  ) {
    return value;
  }

  return "info";
}

const configuredLevel = normalizeLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[configuredLevel];
}

function createLogger(prefix: string) {
  function emit(level: LogLevel, message: string): void {
    if (!shouldLog(level)) {
      return;
    }

    const label = level.toUpperCase();
    const formatted = `${COLORS[level]}${prefix} [${label}] ${message}${COLOR_RESET}`;

    if (level === "error") {
      console.error(formatted);
      return;
    }

    if (level === "warn") {
      console.warn(formatted);
      return;
    }

    console.log(formatted);
  }

  return {
    error(message: string): void {
      emit("error", message);
    },
    warn(message: string): void {
      emit("warn", message);
    },
    info(message: string): void {
      emit("info", message);
    },
    debug(message: string): void {
      emit("debug", message);
    },
  };
}

export const logger = createLogger("[app]");
export const httpLogger = createLogger("[http]");
