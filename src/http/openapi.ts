export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'artemis API',
    version: '1.0.0',
    description:
      'Async JSON API for submitting YouTube URLs, checking job progress, and reading peak detection results.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/peaks': {
      post: {
        summary: 'Create a peak detection job',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                youtubeUrl: 'https://www.youtube.com/watch?v=yPfOVlwlEJQ',
              },
              schema: {
                $ref: '#/components/schemas/CreatePeakJobRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Job created',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreatePeakJobResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/peaks/{jobId}': {
      get: {
        summary: 'Check job progress',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'job-123' },
          },
        ],
        responses: {
          '200': {
            description: 'Job status',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    jobId: 'job-123',
                    alias: 'J1',
                    status: 'running',
                    progress: {
                      stage: 'running',
                      message: 'Job is processing the YouTube URL',
                    },
                  },
                },
                schema: {
                  $ref: '#/components/schemas/JobStatusResponse',
                },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
    '/peaks/{jobId}/result': {
      get: {
        summary: 'Get completed job result',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string', example: 'job-123' },
          },
        ],
        responses: {
          '200': {
            description: 'Peak result',
            content: {
              'application/json': {
                example: {
                  success: true,
                  data: {
                    jobId: 'job-123',
                    alias: 'J1',
                    outputId: 'job-123.json',
                    videoUrl: 'https://www.youtube.com/watch?v=yPfOVlwlEJQ',
                    generatedAt: '2026-05-21T12:00:00.000Z',
                    clips: [
                      {
                        peakIndex: 1,
                        peakTimestampMs: 120000,
                        peakTimestampSec: 120,
                        startMs: 60000,
                        startSec: 60,
                        endMs: 180000,
                        endSec: 180,
                        startFormatted: '01:00',
                        endFormatted: '03:00',
                        peakFormatted: '02:00',
                        normalizedScore: 0.92,
                      },
                    ],
                    output: {
                      topN: 5,
                      windowSize: 30,
                      minGapSeconds: 180,
                    },
                  },
                },
                schema: {
                  $ref: '#/components/schemas/JobResultResponse',
                },
              },
            },
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
          '409': {
            description: 'Job not ready or failed',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CreatePeakJobRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['youtubeUrl'],
        properties: {
          youtubeUrl: {
            type: 'string',
            description: 'YouTube video URL to analyze.',
            example: 'https://www.youtube.com/watch?v=yPfOVlwlEJQ',
          },
        },
      },
      CreatePeakJobResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['jobId', 'alias', 'status', 'checkUrl', 'resultUrl'],
            properties: {
              jobId: { type: 'string', example: 'job-123' },
              alias: {
                type: 'string',
                example: 'J1',
                description: 'Short label used in logs and job status responses.',
              },
              status: { type: 'string', enum: ['queued'], example: 'queued' },
              checkUrl: { type: 'string', example: '/peaks/job-123' },
              resultUrl: { type: 'string', example: '/peaks/job-123/result' },
            },
          },
        },
      },
      JobStatusResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['jobId', 'alias', 'status', 'progress'],
            properties: {
              jobId: { type: 'string', example: 'job-123' },
              alias: {
                type: 'string',
                example: 'J1',
                description: 'Short label used in logs and job status responses.',
              },
              status: {
                type: 'string',
                enum: ['queued', 'running', 'done', 'failed'],
                example: 'running',
              },
              progress: {
                type: 'object',
                required: ['stage', 'message'],
                properties: {
                  stage: { type: 'string', example: 'running' },
                  message: {
                    type: 'string',
                    example: 'Job is processing the YouTube URL',
                  },
                },
              },
              outputId: { type: 'string', example: 'job-123.json' },
              resultUrl: { type: 'string', example: '/peaks/job-123/result' },
              error: { type: 'string', example: 'Job failed' },
            },
          },
        },
      },
      JobResultResponse: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['jobId', 'videoUrl', 'generatedAt', 'clips', 'output', 'outputId'],
            properties: {
              jobId: { type: 'string', example: 'job-123' },
              outputId: { type: 'string', example: 'job-123.json' },
              videoUrl: {
                type: 'string',
                example: 'https://www.youtube.com/watch?v=yPfOVlwlEJQ',
              },
              generatedAt: {
                type: 'string',
                example: '2026-05-21T12:00:00.000Z',
              },
              clips: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    peakIndex: { type: 'integer', example: 1 },
                    peakTimestampMs: { type: 'integer', example: 120000 },
                    startMs: { type: 'integer', example: 60000 },
                    endMs: { type: 'integer', example: 180000 },
                    peakTimestampSec: { type: 'integer', example: 120 },
                    startSec: { type: 'integer', example: 60 },
                    endSec: { type: 'integer', example: 180 },
                    startFormatted: { type: 'string', example: '01:00' },
                    endFormatted: { type: 'string', example: '03:00' },
                    peakFormatted: { type: 'string', example: '02:00' },
                    normalizedScore: { type: 'number', example: 0.92 },
                  },
                },
              },
              output: {
                type: 'object',
                properties: {
                  topN: { type: 'integer', example: 5 },
                  windowSize: { type: 'integer', example: 30 },
                  minGapSeconds: { type: 'integer', example: 180 },
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'JOB_NOT_FOUND' },
              message: { type: 'string', example: 'Job not found' },
              details: {},
            },
          },
        },
      },
    },
  },
} as const;
