import { useQuery } from "@tanstack/react-query";
import { api, ApiError, NetworkError } from "../api";

export type Attachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
};

/** What attachments belong to: `entry=<id>`, `task=<id>` or `checklist=<id>` (a Task with items). */
export type AttachmentOwner = `${"entry" | "task" | "checklist"}=${string}`;

/** The server takes files up to this size; photos are shrunk well below it first. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** A photo's longest side once shrunk: sharp enough to read a document photographed. */
const PHOTO_SIDE = 2048;
const SHRINKABLE = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function useAttachments(owner: AttachmentOwner | null) {
  return useQuery({
    queryKey: ["attachments", owner],
    queryFn: () => api<Attachment[]>(`/attachments?${owner}`),
    enabled: owner !== null,
  });
}

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;
const SHOWN = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** A photo the browser shows, so it gets a thumbnail; others (HEIC, files) a row with a name. */
export const isPhoto = (a: Pick<Attachment, "contentType">) => SHOWN.has(a.contentType);

/**
 * A camera photo shrunk to PHOTO_SIDE as a JPEG, which keeps it to a few hundred KB. A photo the
 * browser can't read, or one already small, goes as it is.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  if (!SHRINKABLE.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
    );
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function jpegName(name: string) {
  return name.replace(/\.[^.]*$/, "") + ".jpg";
}

/** Uploads one picked file, shrinking a photo first. */
export async function uploadAttachment(owner: AttachmentOwner, file: File): Promise<Attachment> {
  const body = await shrinkPhoto(file);
  const type = body === file ? file.type || "application/octet-stream" : "image/jpeg";
  const name = body === file ? file.name : jpegName(file.name);
  const action = "POST /attachments";
  if (body.size > MAX_ATTACHMENT_BYTES)
    throw new ApiError(413, { error: "invalid", field: "size" }, action);
  let res: Response;
  try {
    res = await fetch(`/api/attachments?${owner}`, {
      method: "POST",
      headers: { "Content-Type": type, "X-File-Name": encodeURIComponent(name || "foto.jpg") },
      body,
    });
  } catch (error) {
    throw new NetworkError(action, error);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json, action);
  return json as Attachment;
}

/** "340 KB", "2,4 MB" in the device's language. */
export function fileSize(bytes: number, language: string) {
  const format = (n: number, unit: string) =>
    `${new Intl.NumberFormat(language, { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n)} ${unit}`;
  if (bytes < 1024 * 1024) return format(Math.max(1, Math.round(bytes / 1024)), "KB");
  return format(bytes / (1024 * 1024), "MB");
}
