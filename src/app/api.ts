import type { HolidayPlace } from "../core/holidays";
import type { WasteCollection } from "../core/waste";
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: { error?: string; field?: string; retryAfter?: number; code?: string },
    /** The request, like "PUT /entries/x1"; ids only, never titles. */
    readonly action = "",
  ) {
    super(body.error ?? `HTTP ${status}`);
  }
}

/** The request never got an answer: no connection, or the server couldn't be reached. */
export class NetworkError extends Error {
  constructor(
    readonly action: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "NetworkError";
  }
}

/** Calls the Worker's JSON API; throws ApiError on any non-2xx answer, NetworkError on none. */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}) {
  const method = options.method ?? "GET";
  const action = `${method} ${path.split("?")[0]}`;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: options.body === undefined ? {} : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new NetworkError(action, error);
  }
  const body = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body ?? {}, action);
  return body as T;
}

export type Family = {
  name: string;
  language: string;
  timeZone: string;
  holidayPlaces: HolidayPlace[];
  wasteCollection: WasteCollection;
  lastExportAt: string | null;
};
export type Device = { id: string; name: string; language: string | null };

export type Status = {
  familyExists: boolean;
  newSetupCode: boolean;
  signedIn: boolean;
  family: Family | null;
  device: Device | null;
};
