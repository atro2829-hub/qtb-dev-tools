/**
 * QTB DEV TOOLS — typed client-side API wrapper.
 * Frontend only. Never import server modules here.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Typed fetch wrapper. Always sends credentials (httpOnly auth cookie).
 * - `body` may be a FormData (multipart) or a pre-serialized JSON string.
 * - Throws {@link ApiError} with the server's `{ error }` message when present.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isMultipart = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isMultipart && typeof options.body === "string"
      ? { "Content-Type": "application/json" }
      : {}),
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(path, { credentials: "include", ...options, headers });
  } catch {
    throw new ApiError("Network error — please check your connection and try again.", 0);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const message =
      isRecord(data) && typeof data.error === "string" && data.error.length > 0
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

/** Convenience JSON sender for POST / PUT / PATCH / DELETE. */
export function apiJson<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  payload?: unknown
): Promise<T> {
  return api<T>(path, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/* File helpers                                                        */
/* ------------------------------------------------------------------ */

/** Decode a base64 string (or data URL) into a Blob. */
export function base64ToBlob(dataBase64: string, mimeType: string): Blob {
  const clean = dataBase64.includes(",")
    ? dataBase64.slice(dataBase64.indexOf(",") + 1)
    : dataBase64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Trigger a browser download for a data URL (e.g. base64 PNG). */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  triggerDownload(dataUrl, fileName);
}

function triggerDownload(href: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Human readable file size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Copy text to clipboard with graceful fallback. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
