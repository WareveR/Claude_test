import { StickyNote, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { MAX_NOTE, NOTE_COLORS, NOTE_KEEPS, type NoteColor, type NoteKeep } from "../../core/notes";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { useAddNote, useNotes, useRemoveNote } from "./model";

/** The Wall's button that writes a new Note. */
export function NoteButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t("notes.add")}
        data-testid="note-add"
        className="rounded-md p-1.5 hover:bg-surface"
        onClick={() => setOpen(true)}
      >
        <StickyNote aria-hidden size={20} strokeWidth={1.75} />
      </button>
      {open && <NoteDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The Notes up on the Wall, newest first, each in its paper colour with who wrote it; any of them
 * can be taken down. Nothing shows when there are none.
 */
export function NotesStrip() {
  const { t } = useTranslation();
  const notes = useNotes().data ?? [];
  const remove = useRemoveNote();
  if (notes.length === 0) return null;
  return (
    <ul
      data-testid="notes"
      aria-label={t("notes.title")}
      className="flex max-h-32 flex-wrap gap-2 overflow-y-auto px-3 pb-1 max-sm:px-2"
    >
      {notes.map((note) => (
        <li
          key={note.id}
          data-testid="note"
          style={{ backgroundColor: note.color }}
          className="flex max-w-full min-w-0 items-start gap-1 rounded-md py-1 pr-1 pl-2.5 text-neutral-900 shadow-sm"
        >
          <p className="min-w-0 py-0.5">
            <span className="text-base font-medium break-words">{note.text}</span>
            {note.author && <span className="ml-2 text-xs opacity-70">— {note.author}</span>}
          </p>
          <button
            type="button"
            aria-label={t("notes.remove", { text: note.text })}
            className="shrink-0 rounded p-1 opacity-60 hover:bg-black/10 hover:opacity-100"
            onClick={() => remove.mutate(note.id)}
          >
            <X aria-hidden size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Writes a Note: its text, a paper colour and how long it stays up. */
function NoteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const titleId = useId();
  const add = useAddNote();
  const [text, setText] = useState("");
  const [color, setColor] = useState<NoteColor>(NOTE_COLORS[0]);
  const [keep, setKeep] = useState<NoteKeep>("today");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const said = text.trim();
  const save = () => {
    if (!said) return;
    add.mutate({ text: said, color, keep });
    onClose();
  };
  return createPortal(
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="note-dialog"
        className="flex w-full max-w-md flex-col gap-3 rounded-t-2xl bg-frame p-4 sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t("notes.add")}
        </h2>
        <textarea
          autoFocus
          rows={3}
          value={text}
          maxLength={MAX_NOTE}
          aria-label={t("notes.text")}
          placeholder={t("notes.textHint")}
          onChange={(e) => setText(e.target.value)}
          style={{ backgroundColor: color }}
          className="w-full rounded-md border border-line px-3 py-2 text-base text-neutral-900"
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("notes.color")}>
          {NOTE_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={t("notes.colorN", { n: i + 1 })}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`size-9 rounded-full border-2 ${c === color ? "border-ink" : "border-transparent"}`}
            />
          ))}
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm font-medium">{t("notes.keep")}</legend>
          {NOTE_KEEPS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === keep}
              onClick={() => setKeep(k)}
              className={`min-h-9 rounded-full border px-3 py-1 text-sm ${
                k === keep ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
              }`}
            >
              {t(`notes.keeps.${k}`)}
            </button>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className={BUTTON} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button type="submit" className={BUTTON_PRIMARY} disabled={!said}>
            {t("notes.save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
