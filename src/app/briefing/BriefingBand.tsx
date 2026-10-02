import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Segment } from "../../core/briefing";
import { api } from "../api";
import { usePersonFilter } from "../filter/model";

type Briefing = { segments: Segment[]; fallback: boolean; writtenAt: string } | null;

const COLLAPSED_KEY = "briefing-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Not remembered; the band still works.
  }
}

function linkPath(link: NonNullable<Segment["link"]>): string | null {
  switch (link.kind) {
    case "entry":
      return `/entries/${link.id}?occurrence=${link.date}`;
    case "task":
      return `/tasks/${link.id}`;
    case "checklist":
      return `/checklists/${link.id}`;
    default:
      return null;
  }
}

function SegmentText({ segment }: { segment: Segment }) {
  const to = segment.link ? linkPath(segment.link) : null;
  return to ? (
    <Link to={to} className="underline">
      {segment.text}
    </Link>
  ) : (
    <>{segment.text}</>
  );
}

/**
 * The AI-written Briefing atop today's day view; never written on load, only by Refresh. With
 * exactly one Person filtered it is that Person's, otherwise the Family's.
 */
export function BriefingBand({ readOnly = false }: { readOnly?: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [storedCollapsed, setCollapsed] = useState(readCollapsed);
  // On the wall the band stays open and cannot be refreshed.
  const collapsed = !readOnly && storedCollapsed;
  const { personIds } = usePersonFilter();
  const person = personIds.length === 1 ? personIds[0] : null;
  const query = person ? `?person=${encodeURIComponent(person)}` : "";
  const key = ["briefing", person ?? "family", i18n.language];
  const briefing = useQuery({
    queryKey: key,
    queryFn: () => api<Briefing>(`/briefing${query}`),
  });
  const refresh = useMutation({
    mutationFn: () => api<Briefing>(`/briefing/refresh${query}`, { method: "POST" }),
    onSuccess: (data) => client.setQueryData(key, data),
  });
  const data = briefing.data;
  return (
    <section
      aria-labelledby="briefing-title"
      data-testid="briefing"
      className="mx-4 rounded-md border border-line p-3"
    >
      <div className="flex items-center gap-2">
        <h2 id="briefing-title" className="flex-1 font-semibold">
          {readOnly ? (
            t("briefing.title")
          ) : (
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-controls="briefing-body"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => {
                writeCollapsed(!collapsed);
                setCollapsed(!collapsed);
              }}
            >
              <span aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
              {t("briefing.title")}
            </button>
          )}
        </h2>
        {!collapsed && !readOnly && (
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1 text-sm disabled:opacity-50"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate()}
          >
            {t("briefing.refresh")}
          </button>
        )}
      </div>
      <div id="briefing-body" hidden={collapsed} className="mt-2 text-sm">
        {data === null && <p className="text-muted">{t("briefing.none")}</p>}
        {data && !data.fallback && (
          <p>
            {data.segments.map((s, i) => (
              <SegmentText key={i} segment={s} />
            ))}
          </p>
        )}
        {data?.fallback && (
          <ul className="flex flex-col gap-1">
            {data.segments.map((s, i) => (
              <li key={i} data-testid="briefing-line">
                <SegmentText segment={s} />
              </li>
            ))}
          </ul>
        )}
        {refresh.isError && (
          <p role="alert" className="text-muted">
            {t("briefing.failed")}
          </p>
        )}
      </div>
    </section>
  );
}
