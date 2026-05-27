import { AppConfig } from '../types/config.types';
import { AI_PROVIDER_DEFAULTS, OUTPUT_DEFAULTS } from './defaults';
import { getEnvNumber, getEnvString, getEnvBoolean } from './env';

function normalizeAiProvider(value?: string): AppConfig['ai']['provider'] {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'sumopod') {
    return 'sumopod';
  }

  return 'openrouter';
}

export const config: AppConfig = {
  videoUrl: '',
  auth: {
    mode: getEnvString('YTDLP_AUTH_MODE', 'none') as AppConfig['auth']['mode'],
    browser: getEnvString('YTDLP_AUTH_BROWSER', 'chrome') as AppConfig['auth']['browser'],
    cookiesFile: getEnvString('YTDLP_COOKIES_FILE', './cookies.txt'),
  },
  ytdlp: {
    executablePath: getEnvString('YTDLP_EXECUTABLE', 'yt-dlp'),
    jsRuntime: getEnvString('YTDLP_JS_RUNTIME', 'node'),
    outputDir: getEnvString('YTDLP_OUTPUT_DIR', './output/chat'),
  },
  topN: getEnvNumber('TOP_N', 5),
  clipPadding: {
    before: getEnvNumber('CLIP_PADDING_BEFORE', 60),
    after: getEnvNumber('CLIP_PADDING_AFTER', 60),
  },
  window: {
    size: getEnvNumber('WINDOW_SIZE', 30),
    step: getEnvNumber('WINDOW_STEP', 5),
  },
  peak: {
    minGapSeconds: getEnvNumber('PEAK_MIN_GAP_SECONDS', 180),
  },
  filter: {
    enabled: true,
    minLength: 2,
  },
  ai: {
    enabled: getEnvBoolean('ENABLE_AI', false),
    provider: normalizeAiProvider(
      getEnvString('api_provider', getEnvString('API_PROVIDER', 'openrouter')),
    ),
    openrouter: {
      apiKey: getEnvString('openrouter_api_key', getEnvString('OPENROUTER_API_KEY', '')),
      model: AI_PROVIDER_DEFAULTS.openrouter.model,
      baseUrl: AI_PROVIDER_DEFAULTS.openrouter.baseUrl,
      httpReferer: AI_PROVIDER_DEFAULTS.openrouter.httpReferer,
      appTitle: AI_PROVIDER_DEFAULTS.openrouter.appTitle,
    },
    sumopod: {
      apiKey: getEnvString('sumopod_api_key', getEnvString('SUMOPOD_API_KEY', '')),
      model: getEnvString('SUMOPOD_MODEL', AI_PROVIDER_DEFAULTS.sumopod.model),
      baseUrl: getEnvString('SUMOPOD_BASE_URL', AI_PROVIDER_DEFAULTS.sumopod.baseUrl),
    },
  },
  output: {
    dir: OUTPUT_DEFAULTS.dir,
    filename: OUTPUT_DEFAULTS.filename,
  },
};
