import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export type Person = {
  id: string;
  name: string;
  color: string;
  photoKey: string | null;
  dateOfBirth: string | null;
  nicknames: string[];
  archived: boolean;
};

export { PERSON_COLORS } from "../../core/person-colors";

export function usePersons() {
  return useQuery({ queryKey: ["persons"], queryFn: () => api<Person[]>("/persons") });
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Shrinks a picked photo to at most 256 px and uploads it; returns its new image key. */
export async function uploadPhoto(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/webp", 0.85),
  );
  const res = await fetch("/api/images", {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
  return ((await res.json()) as { key: string }).key;
}
