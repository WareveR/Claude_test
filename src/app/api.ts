import type { HolidayPlace } from "../core/holidays";
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; field?: string; retryAfter?: number },
  ) {
    super(body.error ?? `HTTP ${status}`);
  }
}

/** Calls the Worker's JSON API; throws ApiError on any non-2xx answer. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? {} : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body ?? {});
  return body as T;
}

export type Family = {
  name: string;
  language: string;
  timeZone: string;
  holidayPlaces: HolidayPlace[];
};
export type Device = { id: string; name: string; language: string | null };

export type Status = {
  familyExists: boolean;
  signedIn: boolean;
  family: Family | null;
  device: Device | null;
};
