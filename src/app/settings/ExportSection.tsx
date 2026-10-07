import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zip } from "fflate";
import { useTranslation } from "react-i18next";
import { formatLocale } from "../../core/languages";
import { todayIn } from "../../core/plain-date";
import { api, ApiError, NetworkError } from "../api";
import { useSignedIn } from "../family";

const PARALLEL_IMAGES = 4;
const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

type Export = { tables: Record<string, Record<string, unknown>[]> };
type ImageRow = { key: string; content_type: string };

async function fetchImage(key: string) {
  const action = `GET /images/${key}`;
  let res: Response;
  try {
    res = await fetch("/api/images/" + key);
  } catch (error) {
    throw new NetworkError(action, error);
  }
  if (!res.ok) throw new ApiError(res.status, {}, action);
  return new Uint8Array(await res.arrayBuffer());
}

/** Fetches every image, a few at a time. */
async function fetchImages(rows: ImageRow[]) {
  const files: Record<string, Uint8Array> = {};
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      const ext = EXTENSIONS[row.content_type] ?? "bin";
      files[`images/${row.key}.${ext}`] = await fetchImage(row.key);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL_IMAGES }, worker));
  return files;
}

const zipFiles = (files: Record<string, Uint8Array>) =>
  new Promise<Uint8Array>((resolve, reject) =>
    zip(files, (error, data) => (error ? reject(error) : resolve(data))),
  );

function save(zipped: Uint8Array, date: string) {
  const url = URL.createObjectURL(new Blob([zipped as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-calendar-${date}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Settings › Export: a ZIP of all data and images, built here, and every Entry as .ics. */
export function ExportSection() {
  const { t } = useTranslation();
  const { family, language } = useSignedIn();
  const queryClient = useQueryClient();
  const download = useMutation({
    mutationFn: async () => {
      const data = await api<Export>("/export");
      const images = await fetchImages((data.tables.image ?? []) as ImageRow[]);
      const files = {
        "data.json": new TextEncoder().encode(JSON.stringify(data, null, 2)),
        ...images,
      };
      save(await zipFiles(files), todayIn(family.timeZone));
      await api("/export/done", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["status"] });
    },
  });

  const when = family.lastExportAt
    ? new Date(family.lastExportAt).toLocaleString(formatLocale(language))
    : undefined;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("export.title")}</h2>
      <p className="text-sm text-muted">{t("export.hint")}</p>
      <button
        type="button"
        disabled={download.isPending}
        onClick={() => download.mutate()}
        className="self-start rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
      >
        {download.isPending ? t("export.preparing") : t("export.download")}
      </button>
      <a href="/api/export/entries.ics" download className="self-start underline">
        {t("export.entries")}
      </a>
      <p className="text-sm text-muted">{when ? t("export.last", { when }) : t("export.never")}</p>
    </section>
  );
}
