import { Response } from 'express';

type JsonResponse = Record<string, unknown>;

export function sendSuccess<T>(response: Response, data: T, statusCode = 200): Response {
  return response.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const payload: JsonResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    (payload.error as Record<string, unknown>).details = details;
  }

  return response.status(statusCode).json(payload);
}
