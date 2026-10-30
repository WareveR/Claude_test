import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api";
import { useOnline } from "../offline/online";
import { BUTTON } from "../ui/button";
import {
  attachmentUrl,
  fileSize,
  isPhoto,
  MAX_ATTACHMENT_BYTES,
  uploadAttachment,
  useAttachments,
  type AttachmentOwner,
} from "./model";

/** A phone or tablet, where a separate "Take a photo" button opens the camera straight away. */
const touch = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

/**
 * Photos and files attached to an Entry, a Task or a Task with items. On a saved one each picked
 * file is uploaded at once; on a new one they wait in `pending` until it is saved
 * (see uploadPending).
 */
export function Attachments({
  owner,
  pending = [],
  onPending,
  readOnly = false,
  className = "rounded-lg border border-line p-3",
}: {
  owner: AttachmentOwner | null;
  pending?: File[];
  onPending?: (files: File[]) => void;
  /** An Entry's summary: only what is attached, nothing when there is none. */
  readOnly?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const online = useOnline();
  const queryClient = useQueryClient();
  const list = useAttachments(owner);
  const saved = list.data ?? [];
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["attachments", owner] });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await uploadAttachment(owner!, file);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status === 413
          ? t("attachments.tooBig")
          : e instanceof ApiError
            ? t("errors.unexpected")
            : t("errors.network"),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(attachmentUrl(id), { method: "DELETE" });
      if (!res.ok) throw new ApiError(res.status, {}, "DELETE /attachments");
    },
    onError: () => setError(t("errors.unexpected")),
    onSettled: refresh,
  });

  function picked(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);
    // Photos are shrunk before upload, so only other files can be too big.
    const tooBig = files.filter(
      (f) => !f.type.startsWith("image/") && f.size > MAX_ATTACHMENT_BYTES,
    );
    if (tooBig.length > 0) setError(t("attachments.tooBig"));
    const ok = files.filter((f) => !tooBig.includes(f));
    if (ok.length === 0) return;
    if (owner) upload.mutate(ok);
    else onPending?.([...pending, ...ok]);
  }

  const busy = upload.isPending || remove.isPending;
  const disabled = busy || (owner !== null && !online);
  const empty = saved.length === 0 && pending.length === 0;
  if (readOnly && empty) return null;
  return (
    <section className={`flex flex-col gap-2 ${className}`} data-testid="attachments">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <Paperclip size={16} aria-hidden />
        {t("attachments.title")}
      </h3>
      {empty && !busy && !readOnly && <p className="text-sm text-muted">{t("attachments.none")}</p>}
      {saved.some(isPhoto) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {saved.filter(isPhoto).map((a) => (
            <li key={a.id} className="relative">
              <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" title={a.name}>
                <img
                  src={attachmentUrl(a.id)}
                  alt={a.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-md border border-line object-cover"
                />
              </a>
              {!readOnly && (
                <RemoveButton
                  label={t("attachments.remove", { name: a.name })}
                  disabled={disabled}
                  className="absolute top-1 right-1 bg-surface/90"
                  onClick={() =>
                    window.confirm(t("attachments.confirmRemove", { name: a.name })) &&
                    remove.mutate(a.id)
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {(saved.some((a) => !isPhoto(a)) || pending.length > 0) && (
        <ul className="flex flex-col gap-1">
          {saved
            .filter((a) => !isPhoto(a))
            .map((a) => (
              <FileRow
                key={a.id}
                name={a.name}
                size={fileSize(a.size, i18n.language)}
                href={attachmentUrl(a.id)}
              >
                {!readOnly && (
                  <RemoveButton
                    label={t("attachments.remove", { name: a.name })}
                    disabled={disabled}
                    onClick={() =>
                      window.confirm(t("attachments.confirmRemove", { name: a.name })) &&
                      remove.mutate(a.id)
                    }
                  />
                )}
              </FileRow>
            ))}
          {pending.map((file, i) => (
            <FileRow
              key={`${file.name}:${i}`}
              name={file.name}
              size={t("attachments.onSave")}
              photo={file.type.startsWith("image/")}
            >
              <RemoveButton
                label={t("attachments.remove", { name: file.name })}
                onClick={() => onPending?.(pending.filter((_, j) => j !== i))}
              />
            </FileRow>
          ))}
        </ul>
      )}
      {upload.isPending && <p className="text-sm text-muted">{t("attachments.uploading")}</p>}
      {error && (
        <p role="alert" className="text-sm text-overdue">
          {error}
        </p>
      )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {touch() && (
            <PickButton accept="image/*" capture disabled={disabled} onChange={picked}>
              <Camera size={16} aria-hidden />
              {t("attachments.camera")}
            </PickButton>
          )}
          <PickButton accept="image/*" multiple disabled={disabled} onChange={picked}>
            <ImageIcon size={16} aria-hidden />
            {t("attachments.photos")}
          </PickButton>
          <PickButton multiple disabled={disabled} onChange={picked}>
            <Paperclip size={16} aria-hidden />
            {t("attachments.files")}
          </PickButton>
        </div>
      )}
    </section>
  );
}

/** Uploads the files picked on a new Entry or Task, once it is saved and has an id. */
export async function uploadPending(owner: AttachmentOwner, files: File[]) {
  for (const file of files) await uploadAttachment(owner, file);
}

/** A button that opens the phone's camera, its gallery, or the file picker. */
function PickButton({
  accept,
  capture,
  multiple,
  disabled,
  onChange,
  children,
}: {
  accept?: string;
  capture?: boolean;
  multiple?: boolean;
  disabled: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={BUTTON}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {children}
      </button>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={accept}
        capture={capture ? "environment" : undefined}
        multiple={multiple}
        onChange={onChange}
      />
    </>
  );
}

function FileRow({
  name,
  size,
  href,
  photo = false,
  children,
}: {
  name: string;
  size: string;
  href?: string;
  photo?: boolean;
  children: ReactNode;
}) {
  const Icon = photo ? ImageIcon : FileText;
  const label = (
    <>
      <Icon size={18} aria-hidden className="shrink-0 text-muted" />
      <span className="min-w-0 truncate">{name}</span>
      <span className="shrink-0 text-xs text-muted">{size}</span>
    </>
  );
  return (
    <li className="flex items-center gap-2 text-sm">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
      )}
      {children}
    </li>
  );
}

function RemoveButton({
  label,
  disabled,
  className = "",
  onClick,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full p-1 text-muted hover:text-overdue disabled:opacity-50 ${className}`}
    >
      <X size={16} aria-hidden />
    </button>
  );
}
