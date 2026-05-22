# artemis API

TypeScript API for analyzing YouTube live chat replay and returning the peak moments as JSON.

## Features

- Async job submission for YouTube URLs
- Consistent JSON responses for success and error cases
- Job status polling and result retrieval by job ID
- OpenAPI document at `/openapi.json`
- Interactive Scalar docs at `/docs`

## Install

```bash
npm install
```

## Configure

Fill in [.env](.env). A ready template is available in [.env.example](.env.example).

- `TOP_N` for how many peaks to return
- `CLIP_PADDING_BEFORE` and `CLIP_PADDING_AFTER` for clip padding
- `WINDOW_SIZE` and `WINDOW_STEP` for the rolling window
- `PEAK_MIN_GAP_SECONDS` for the minimum distance between peaks
- `LOG_LEVEL` to control logger output (`error`, `warn`, `info`, or `debug`)
- `openrouter_api_key` and `sumopod_api_key` for AI provider authentication

AI provider settings other than API keys are hardcoded in [`src/config/constant.ts`](src/config/constant.ts).

OpenRouter uses the standard chat completions endpoint at `https://openrouter.ai/api/v1/chat/completions`.
The API key is sent as a Bearer token.

`info` is the default level.

## Run

```bash
npm start
```

For development mode:

```bash
npm run dev
```

## API

### `POST /peaks`

Creates a job.

Request body:

```json
{
  "youtubeUrl": "https://www.youtube.com/watch?v=..."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "jobId": "job-123",
    "status": "queued",
    "checkUrl": "/peaks/job-123",
    "resultUrl": "/peaks/job-123/result"
  }
}
```

### `GET /peaks/:jobId`

Checks job progress.

### `GET /peaks/:jobId/result`

Returns the final result when the job is done.

## Docs

- OpenAPI JSON: `/openapi.json`
- Scalar playground: `/docs`

## Build

```bash
npm run build
```

## Logs

- App and system logs use the `app` prefix.
- HTTP request logs use the `http` prefix.

## Notes

- Tuning values are read from env, not from the request body.
- Make sure the video has live chat replay enabled.
- If `youtubeUrl` is empty or invalid, the request is rejected with `VALIDATION_ERROR`.
