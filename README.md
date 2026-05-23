# Artemis

Artemis is a small TypeScript service that analyzes YouTube live chat replay to detect high-activity "peak" moments and returns them as JSON. It is implemented as an async job API so long-running analysis runs in the background and results are retrievable by job ID.

Key points

- Submits analysis jobs via `POST /peaks` and returns a `jobId` immediately.
- Poll job progress with `GET /peaks/:jobId` and fetch final results from `GET /peaks/:jobId/result`.
- Uses a rolling time-window analysis to score chat activity, then applies heuristics and an optional AI reranker to select top clips.
- OpenAPI spec is available at `/openapi.json` and an interactive Scalar playground is served at `/docs`.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables (see `.env.example`). Important vars include API keys for AI providers and tuning values such as `TOP_N`, `WINDOW_SIZE`, and `WINDOW_STEP`.

3. Run in development:

```bash
npm run dev
```

Or build and run:

```bash
npm run build
npm start
```

Useful scripts

- `npm run dev` — development runner (uses `tsx`)
- `npm run build` — TypeScript build
- `npm start` — run compiled output
- `npm run lint` / `npm run format` — code quality tools

Configuration and code locations

- Runtime defaults and env parsing: `src/config/constant.ts` and `src/config/env.ts`.
- Main HTTP server: `src/server.ts`.
- Pipeline entrypoint: `src/modules/pipeline.ts`.
- Time-series windowing and normalization: `src/core/window.ts` and `src/core/normalizer.ts`.
- AI ranking and providers: `src/ai/*` (OpenRouter and Sumopod integrations).
- Output files are written under `output/` by default.

Behavior notes

- The API returns consistent JSON envelopes for success and error cases.
- Tuning parameters are primarily read from environment variables and validated at job creation.
- The AI reranker is optional and requires provider API keys; if missing, the service falls back to heuristic selection.

Contributing

- Open issues or submit PRs; keep changes minimal and run `npm run lint` and `npm run format` before committing.

License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
