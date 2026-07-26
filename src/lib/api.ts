"use client";

import { queueRequest } from "./outbox";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * One fetch wrapper for every query and mutation: JSON in, JSON out, errors as
 * `ApiError` so React Query can decide whether a retry is worth attempting.
 * A write that fails because the device is offline goes to the outbox and is
 * replayed on reconnect rather than being lost.
 */
export async function api<T>(
  path: string,
  init: RequestInit & { queueWhenOffline?: boolean } = {},
): Promise<T> {
  const { queueWhenOffline, ...request } = init;
  const method = request.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(path, {
      ...request,
      headers:
        request.body && !(request.body instanceof FormData)
          ? { "Content-Type": "application/json", ...request.headers }
          : request.headers,
    });
  } catch (error) {
    if (queueWhenOffline && typeof request.body === "string") {
      queueRequest(path, method, request.body);
      // The write is safe on disk; the caller's optimistic state stands.
      return undefined as T;
    }
    throw error;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? response.statusText, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** 4xx responses are the caller's fault and will never succeed on a retry. */
export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}
