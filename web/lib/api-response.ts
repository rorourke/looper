import { NextResponse } from "next/server.js";

export type ApiErrorBody = {
  error: {
    code: string;
    details?: unknown;
    message: string;
  };
};

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff"
};

export class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status: number;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function privateJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

export function apiErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(500, "internal_error", "The request could not be completed.");
  const response = privateJson<ApiErrorBody>(
    {
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details === undefined ? {} : { details: apiError.details })
      }
    },
    apiError.status
  );

  if (apiError.status === 401) {
    response.headers.set("WWW-Authenticate", "Bearer");
  }
  return response;
}
