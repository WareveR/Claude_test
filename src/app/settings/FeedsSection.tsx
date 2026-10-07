import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { usePersons } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { ErrorText, Field, SubmitButton, TextInput } from "../screens/form";
import { BUTTON } from "../ui/button";

type FeedRow = {
  id: string;
  name: string;
  familyWide: boolean;
  personIds: string[];
  createdAt: string;
  replacedAt: string | null;
};
type FeedWithUrl = FeedRow & { url: string };

/** Settings › Calendar Feeds: read-only addresses other calendar apps subscribe to. */
export function FeedsSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const persons = usePersons();
  const feeds = useQuery({ queryKey: ["feeds"], queryFn: () => api<FeedRow[]>("/feeds") });
  const [name, setName] = useState("");
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [familyWide, setFamilyWide] = useState(true);
  // The address is shown once, so it lives only here; never in storage.
  const [shown, setShown] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["feeds"] });

  const create = useMutation({
    mutationFn: () =>
      api<FeedWithUrl>("/feeds", { method: "POST", body: { name, personIds, familyWide } }),
    onSuccess: async (feed) => {
      setShown(feed.url);
      setName("");
      setPersonIds([]);
      setFamilyWide(true);
      await refresh();
    },
  });
  const replace = useMutation({
    mutationFn: (id: string) => api<FeedWithUrl>(`/feeds/${id}/replace`, { method: "POST" }),
    onSuccess: async (feed) => {
      setShown(feed.url);
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/feeds/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const people = persons.data ?? [];
  const covers = (feed: FeedRow) =>
    [
      feed.personIds.length === 0
        ? t("feeds.everyone")
        : feed.personIds.map((id) => people.find((p) => p.id === id)?.name ?? "").join(", "),
      feed.familyWide && t("feeds.plusFamilyWide"),
    ]
      .filter(Boolean)
      .join(" ");

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("feeds.title")}</h2>
      <p className="text-sm text-muted">{t("feeds.hint")}</p>
      {shown && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm text-ink"
        >
          <p className="font-medium">{t("feeds.copyNow")}</p>
          <input
            readOnly
            aria-label={t("feeds.address")}
            value={shown}
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-md border border-line bg-surface px-3 py-2 text-base"
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              className={BUTTON}
              onClick={() => navigator.clipboard?.writeText(shown).catch(() => {})}
            >
              {t("feeds.copy")}
            </button>
            <a className={BUTTON} href={shown.replace(/^https?:\/\//, "webcal://")}>
              {t("feeds.open")}
            </a>
            <button type="button" className={`${BUTTON} ml-auto`} onClick={() => setShown(null)}>
              {t("feeds.done")}
            </button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-line rounded-md border border-line">
        {feeds.data?.map((feed) => (
          <li key={feed.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex flex-1 flex-col">
              <span className="font-medium">{feed.name}</span>
              <span className="text-xs text-muted">{covers(feed)}</span>
            </div>
            <button
              type="button"
              className={BUTTON}
              aria-label={t("feeds.replaceOf", { name: feed.name })}
              onClick={() => {
                if (window.confirm(t("feeds.confirmReplace", { name: feed.name }))) {
                  replace.mutate(feed.id);
                }
              }}
            >
              {t("feeds.replace")}
            </button>
            <button
              type="button"
              className={BUTTON}
              aria-label={t("feeds.revokeOf", { name: feed.name })}
              onClick={() => {
                if (window.confirm(t("feeds.confirmRevoke", { name: feed.name }))) {
                  revoke.mutate(feed.id);
                }
              }}
            >
              {t("feeds.revoke")}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Field label={t("feeds.name")}>
          <TextInput required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("feeds.forWhom")}</legend>
          <div className="flex flex-wrap gap-3">
            {people
              .filter((p) => !p.archived)
              .map((p) => (
                <label key={p.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={personIds.includes(p.id)}
                    onChange={(e) =>
                      setPersonIds(
                        e.target.checked
                          ? [...personIds, p.id]
                          : personIds.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span aria-hidden>
                    <PersonAvatar person={p} size={24} />
                  </span>
                  {p.name}
                </label>
              ))}
          </div>
          <p className="text-xs text-muted">{t("feeds.noneHint")}</p>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={familyWide}
            onChange={(e) => setFamilyWide(e.target.checked)}
          />
          {t("feeds.familyWide")}
        </label>
        {(create.error || replace.error || revoke.error) && (
          <ErrorText>{t("errors.unexpected")}</ErrorText>
        )}
        <div className="self-start">
          <SubmitButton busy={create.isPending}>{t("feeds.create")}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
