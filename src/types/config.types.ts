export type AuthMode = "none" | "browser" | "cookies-file";
export type BrowserName =
  | "chrome"
  | "firefox"
  | "edge"
  | "brave"
  | "opera"
  | "chromium";

export interface AppConfig {
  videoUrl: string;
  auth: {
    mode: AuthMode;
    browser?: BrowserName;
    cookiesFile?: string;
  };
  ytdlp: {
    executablePath: string;
    outputDir: string;
  };
  topN: number;
  clipPadding: {
    before: number;
    after: number;
  };
  window: {
    size: number;
    step: number;
  };
  peak: {
    minGapSeconds: number;
  };
  filter: {
    enabled: boolean;
    keywords: string[];
    minLength: number;
  };
  output: {
    dir: string;
    filename: string;
  };
}
