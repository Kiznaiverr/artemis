import fs from "fs";
import path from "path";
import { AppConfig } from "../types/config.types";

type EnvMap = Record<string, string>;

function parseEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const entries: EnvMap = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key) {
      entries[key] = value;
    }
  }

  return entries;
}

function loadEnv(): void {
  // Load local environment variables without adding another dependency.
  const envPath = path.resolve(process.cwd(), ".env");
  const envFile = parseEnvFile(envPath);

  for (const [key, value] of Object.entries(envFile)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getEnvString(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function getEnvNumber(key: string, fallback: number): number {
  const rawValue = process.env[key];
  if (rawValue === undefined || rawValue.trim() === "") {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

loadEnv();

export const config: AppConfig = {
  videoUrl: "",
  auth: {
    mode: getEnvString("YTDLP_AUTH_MODE", "none") as AppConfig["auth"]["mode"],
    browser: getEnvString(
      "YTDLP_AUTH_BROWSER",
      "chrome",
    ) as AppConfig["auth"]["browser"],
    cookiesFile: getEnvString("YTDLP_COOKIES_FILE", "./cookies.txt"),
  },
  ytdlp: {
    executablePath: getEnvString("YTDLP_EXECUTABLE", "yt-dlp"),
    jsRuntime: getEnvString("YTDLP_JS_RUNTIME", "node"),
    outputDir: getEnvString("YTDLP_OUTPUT_DIR", "./output/chat"),
  },
  topN: getEnvNumber("TOP_N", 5),
  clipPadding: {
    before: getEnvNumber("CLIP_PADDING_BEFORE", 60),
    after: getEnvNumber("CLIP_PADDING_AFTER", 60),
  },
  window: {
    size: getEnvNumber("WINDOW_SIZE", 30),
    step: getEnvNumber("WINDOW_STEP", 5),
  },
  peak: {
    minGapSeconds: getEnvNumber("PEAK_MIN_GAP_SECONDS", 180),
  },
  filter: {
    enabled: true,
    minLength: 2,
  },
  ai: {
    openrouter: {
      apiKey: getEnvString(
        "openrouter_api_key",
        getEnvString("OPENROUTER_API_KEY", ""),
      ),
      model: "deepseek/deepseek-v4-flash:free",
      baseUrl: "https://openrouter.ai/api/v1",
      httpReferer: "https://github.com/kiznaiverr/artemis",
      appTitle: "artemis",
    },
    sumopod: {
      apiKey: getEnvString(
        "sumopod_api_key",
        getEnvString("SUMOPOD_API_KEY", ""),
      ),
    },
  },
  output: {
    dir: "./output",
    filename: "peaks.json",
  },
};
