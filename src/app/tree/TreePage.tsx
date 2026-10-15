import { Cake, Heart, MapPin, Plus, Sparkles, TreeDeciduous, UserRoundPen, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import {
  ageOf,
  childrenOf,
  connection,
  kinship,
  layoutTree,
  siblingsOf,
  type Relative,
} from "../../core/family-tree";
import { daysBetween, todayIn, type PlainDate } from "../../core/plain-date";
import { useSignedIn } from "../family";
import { PERSON_COLORS } from "../persons/model";
import { PersonAvatar } from "../persons/PersonAvatar";
import { paths } from "../paths";
import { ViewNav } from "../shell/ViewNav";
import { BUTTON, BUTTON_PRIMARY } from "../ui/button";
import { longDate, setTreeRoot, treeRoot, useKinWords, useRelatives } from "./model";

/** A colour of its own for each Relative without a photo. */
function colorOf(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[hash % PERSON_COLORS.length];
}

function RelativeAvatar({
  relative,
  size,
  className = "",
}: {
  relative: Relative;
  size: number;
  className?: string;
}) {
  return (
    <span className={`rounded-full ${relative.deathDate ? "grayscale-[60%]" : ""} ${className}`}>
      <PersonAvatar
        person={{ name: relative.name, photoKey: relative.photoKey, color: colorOf(relative.id) }}
        size={size}
      />
    </span>
  );
}

function years(r: Relative) {
  const born = r.birthDate?.slice(0, 4);
  const died = r.deathDate?.slice(0, 4);
  if (born && died) return `${born}–${died}`;
  if (died) return `– ${died}`;
  return born ?? "";
}

/** The Family Tree: generations in rows, a card for whoever is picked, kinship for two. */
export function TreePage() {
  const { t } = useTranslation();
  const { family } = useSignedIn();
  const today = todayIn(family.timeZone);
  const relatives = useRelatives().data;
  const [search, setSearch] = useSearchParams();
  const [rootChoice, setRootChoice] = useState(0);
  const picked = (search.get("sel") ?? "").split(",").filter(Boolean);
  const byId = useMemo(() => new Map((relatives ?? []).map((r) => [r.id, r])), [relatives]);
  const selected = picked.filter((id) => byId.has(id)).slice(0, 2);
  const select = (ids: string[]) =>
    setSearch(ids.length ? { sel: ids.join(",") } : {}, { replace: true });
  const toggle = (id: string) => {
    if (selected.includes(id)) select(selected.filter((s) => s !== id));
    else if (selected.length === 1) select([selected[0], id]);
    else select([id]);
  };

  // rootChoice re-reads the device's choice after it changes.
  const root = useMemo(
    () => (relatives ? treeRoot(relatives) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relatives, rootChoice],
  );
  const path = useMemo(
    () =>
      relatives && selected.length === 2 ? connection(relatives, selected[0], selected[1]) : [],
    [relatives, selected],
  );

  return (
    <>
      <ViewNav date={today} title={t("tree.title")} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-3 pb-24 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label={t("tree.title")}>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={paths.relative("new")} className={BUTTON_PRIMARY} data-testid="tree-add">
              <Plus aria-hidden size={16} />
              {t("tree.add")}
            </Link>
            {relatives && relatives.length > 1 && root && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">{t("tree.from")}</span>
                <select
                  value={root}
                  onChange={(e) => {
                    setTreeRoot(e.target.value);
                    setRootChoice((n) => n + 1);
                  }}
                  className="rounded-md border border-line bg-surface px-2 py-1"
                >
                  {relatives.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {relatives && relatives.length === 0 && <EmptyTree />}
          {relatives && relatives.length > 0 && (
            <TreeCanvas
              relatives={relatives}
              root={root}
              selected={selected}
              path={path}
              onPick={toggle}
            />
          )}
        </section>
        {relatives && relatives.length > 0 && (
          <aside className="flex flex-col gap-3 lg:sticky lg:top-16 lg:w-96 lg:shrink-0">
            {selected.length === 0 && (
              <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
                {t("tree.hint")}
              </p>
            )}
            {selected.length === 1 && (
              <RelativeCard
                relative={byId.get(selected[0])!}
                relatives={relatives}
                root={root}
                today={today}
                onPick={(id) => select([id])}
                onClose={() => select([])}
              />
            )}
            {selected.length === 2 && (
              <KinshipCard
                a={byId.get(selected[0])!}
                b={byId.get(selected[1])!}
                relatives={relatives}
                onClose={() => select([])}
              />
            )}
          </aside>
        )}
      </main>
    </>
  );
}

function EmptyTree() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
      <TreeDeciduous aria-hidden size={48} strokeWidth={1.25} className="text-accent" />
      <p className="font-semibold">{t("tree.emptyTitle")}</p>
      <p className="max-w-sm text-sm text-muted">{t("tree.emptyHint")}</p>
    </div>
  );
}

type Line = { d: string; lit: boolean };

/** The rows of the tree, with curved lines from each pair of parents down to their children. */
function TreeCanvas({
  relatives,
  root,
  selected,
  path,
  onPick,
}: {
  relatives: Relative[];
  root: string | null;
  selected: string[];
  path: string[];
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const layout = useMemo(() => layoutTree(relatives, root), [relatives, root]);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onPath = new Set(path);
  const rootName = relatives.find((r) => r.id === root)?.name ?? "";
  const rootGeneration = layout.rows.find((row) =>
    row.units.some((u) => u.includes(root ?? "")),
  )?.generation;

  useLayoutEffect(() => {
    const box = inner.current;
    if (!box) return;
    const draw = () => {
      const base = box.getBoundingClientRect();
      const at = (id: string) => {
        const r = cards.current.get(id)?.getBoundingClientRect();
        return r
          ? {
              x: r.left - base.left + r.width / 2,
              top: r.top - base.top,
              bottom: r.bottom - base.top,
            }
          : null;
      };
      const next: Line[] = [];
      const lit = new Set(path);
      for (const child of relatives) {
        const c = at(child.id);
        const parents = child.parentIds.map((p) => ({ id: p, at: at(p) })).filter((p) => p.at);
        if (!c || parents.length === 0) continue;
        const x = parents.reduce((s, p) => s + p.at!.x, 0) / parents.length;
        const y = Math.max(...parents.map((p) => p.at!.bottom));
        const mid = (y + c.top) / 2;
        next.push({
          d: `M ${x} ${y} C ${x} ${mid}, ${c.x} ${mid}, ${c.x} ${c.top}`,
          lit: lit.has(child.id) && parents.some((p) => lit.has(p.id)),
        });
      }
      setLines(next);
      setSize({ w: box.scrollWidth, h: box.scrollHeight });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [layout, relatives, path]);

  // A tree wider than the screen opens with its root in the middle.
  useLayoutEffect(() => {
    const box = outer.current;
    const card = root ? cards.current.get(root) : undefined;
    if (!box || !card || box.scrollWidth <= box.clientWidth) return;
    const left = card.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollLeft += left - (box.clientWidth - card.offsetWidth) / 2;
  }, [root, layout]);

  const label = (generation: number) => {
    if (rootGeneration === undefined) return "";
    const g = generation - rootGeneration;
    if (g === 0) return t("tree.gen.same", { name: rootName });
    const words: Record<number, string> = {
      [-1]: "parents",
      [-2]: "grandparents",
      [-3]: "greatGrandparents",
      [-4]: "greatGreatGrandparents",
      1: "children",
      2: "grandchildren",
    };
    if (words[g]) return t(`tree.gen.${words[g]}`);
    return g < 0 ? t("tree.gen.above", { count: -g }) : t("tree.gen.below", { count: g });
  };

  return (
    <div ref={outer} className="overflow-x-auto rounded-2xl border border-line bg-surface/60">
      <div ref={inner} className="relative mx-auto flex w-max min-w-full flex-col gap-10 p-4 pt-2">
        <svg
          aria-hidden
          width={size.w}
          height={size.h}
          className="pointer-events-none absolute inset-0"
          fill="none"
        >
          {lines.map((line, i) => (
            <path
              key={i}
              d={line.d}
              strokeWidth={line.lit ? 3 : 1.5}
              strokeLinecap="round"
              className={line.lit ? "stroke-accent" : "stroke-muted/50"}
            />
          ))}
        </svg>
        {layout.rows.map((row) => (
          <div key={row.generation} className="relative flex flex-col items-center gap-2">
            <span className="sticky left-0 self-start text-xs font-medium tracking-wide text-muted uppercase">
              {label(row.generation)}
            </span>
            <div className="flex items-start justify-center gap-3 sm:gap-6">
              {row.units.map((unit) => (
                <div key={unit.join()} className="flex items-center gap-1">
                  {unit.map((id, i) => {
                    const r = relatives.find((x) => x.id === id)!;
                    return (
                      <div key={id} className="flex items-center gap-1">
                        {i > 0 && (
                          <Heart
                            aria-label={t("tree.couple")}
                            size={14}
                            className="shrink-0 fill-current text-accent/70"
                          />
                        )}
                        <button
                          type="button"
                          ref={(el) => {
                            if (el) cards.current.set(id, el);
                            else cards.current.delete(id);
                          }}
                          data-testid={`relative-${r.name}`}
                          aria-pressed={selected.includes(id)}
                          onClick={() => onPick(id)}
                          className={`relative z-10 flex w-20 flex-col sm:w-24 items-center gap-1 rounded-2xl border bg-surface p-2 text-center shadow-sm transition-shadow hover:shadow-md ${
                            selected.includes(id)
                              ? "border-accent ring-2 ring-accent"
                              : onPath.has(id)
                                ? "border-accent"
                                : "border-line"
                          }`}
                        >
                          <RelativeAvatar relative={r} size={56} className="max-sm:*:!size-11" />
                          <span className="line-clamp-2 text-sm leading-tight font-semibold">
                            {r.name}
                          </span>
                          {r.nickname && (
                            <span className="line-clamp-1 text-xs text-muted italic">
                              “{r.nickname}”
                            </span>
                          )}
                          {years(r) && <span className="text-xs text-muted">{years(r)}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({
  children,
  onClose,
  testId,
}: {
  children: ReactNode;
  onClose: () => void;
  testId: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("tree.closeCard")}
        className="absolute top-2 right-2 rounded-md p-1 text-muted hover:bg-line/60"
      >
        <X aria-hidden size={18} />
      </button>
      {children}
    </div>
  );
}

function Chips({
  title,
  people,
  onPick,
}: {
  title: string;
  people: Relative[];
  onPick: (id: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-2.5 pl-0.5 text-sm hover:bg-line/60"
          >
            <RelativeAvatar relative={p} size={22} />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Birthday news for the living: today, or within a month. */
function nextBirthday(birthDate: PlainDate, today: PlainDate) {
  let year = Number(today.slice(0, 4));
  let next = `${year}-${birthDate.slice(5)}`;
  if (next < today) next = `${++year}-${birthDate.slice(5)}`;
  return { days: daysBetween(today, next), turns: year - Number(birthDate.slice(0, 4)) };
}

function RelativeCard({
  relative: r,
  relatives,
  root,
  today,
  onPick,
  onClose,
}: {
  relative: Relative;
  relatives: Relative[];
  root: string | null;
  today: PlainDate;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { word } = useKinWords();
  const byId = new Map(relatives.map((x) => [x.id, x]));
  const age = ageOf(r, today);
  const rootRelative = root && root !== r.id ? byId.get(root) : undefined;
  const toRoot = rootRelative ? kinship(relatives, root!, r.id) : null;
  const parents = r.parentIds.map((id) => byId.get(id)!).filter(Boolean);
  const partners = r.partnerIds.map((id) => byId.get(id)!).filter(Boolean);
  const birthday = r.birthDate && !r.deathDate ? nextBirthday(r.birthDate, today) : null;
  const add = (param: string) => `${paths.relative("new")}?${param}=${r.id}`;
  return (
    <Panel onClose={onClose} testId="relative-card">
      <div className="flex items-center gap-4 pr-6">
        <RelativeAvatar relative={r} size={88} />
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xl leading-tight font-semibold">{r.name}</h2>
          {r.nickname && <span className="text-muted italic">“{r.nickname}”</span>}
          {toRoot && (toRoot.kind === "blood" || toRoot.kind === "affinity") && (
            <span className="text-sm font-medium text-accent first-letter:uppercase">
              {t("tree.ofRoot", {
                word: word(toRoot.word, r.sex, toRoot.kind === "blood" ? toRoot.count : 0),
                name: rootRelative!.name,
              })}
            </span>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {r.birthDate && (
          <li className="flex items-start gap-2">
            <Cake aria-hidden size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>
              {t("tree.born", { date: longDate(r.birthDate, i18n.language) })}
              {age !== null && !r.deathDate && ` · ${t("tree.age", { count: age })}`}
            </span>
          </li>
        )}
        {r.birthPlace && (
          <li className="flex items-start gap-2">
            <MapPin aria-hidden size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>{t("tree.bornIn", { place: r.birthPlace })}</span>
          </li>
        )}
        {r.deathDate && (
          <li className="flex items-start gap-2">
            <Sparkles aria-hidden size={16} className="mt-0.5 shrink-0 text-muted" />
            <span>
              {t("tree.died", { date: longDate(r.deathDate, i18n.language) })}
              {age !== null && ` · ${t("tree.diedAge", { count: age })}`}
            </span>
          </li>
        )}
        {birthday && birthday.days <= 31 && (
          <li className="rounded-lg bg-accent/10 px-2 py-1 font-medium text-accent">
            {birthday.days === 0
              ? t("tree.birthdayToday", { count: birthday.turns })
              : t("tree.birthdaySoon", { count: birthday.turns, days: birthday.days })}
          </li>
        )}
      </ul>
      {r.notes && (
        <blockquote className="rounded-xl border-l-4 border-accent/60 bg-bg px-3 py-2 text-sm whitespace-pre-wrap">
          {r.notes}
        </blockquote>
      )}
      <div className="flex flex-col gap-2">
        <Chips title={t("tree.parents")} people={parents} onPick={onPick} />
        <Chips title={t("tree.partners")} people={partners} onPick={onPick} />
        <Chips title={t("tree.siblings")} people={siblingsOf(relatives, r.id)} onPick={onPick} />
        <Chips title={t("tree.children")} people={childrenOf(relatives, r.id)} onPick={onPick} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Link to={paths.relative(r.id)} className={BUTTON}>
          <UserRoundPen aria-hidden size={16} />
          {t("tree.edit")}
        </Link>
        {parents.length < 2 && (
          <Link to={add("parentOf")} className={BUTTON}>
            <Plus aria-hidden size={16} />
            {t("tree.addParent")}
          </Link>
        )}
        <Link to={add("partnerOf")} className={BUTTON}>
          <Plus aria-hidden size={16} />
          {t("tree.addPartner")}
        </Link>
        <Link to={add("childOf")} className={BUTTON}>
          <Plus aria-hidden size={16} />
          {t("tree.addChild")}
        </Link>
        {parents.length > 0 && (
          <Link to={add("siblingOf")} className={BUTTON}>
            <Plus aria-hidden size={16} />
            {t("tree.addSibling")}
          </Link>
        )}
      </div>
    </Panel>
  );
}

function KinshipCard({
  a,
  b,
  relatives,
  onClose,
}: {
  a: Relative;
  b: Relative;
  relatives: Relative[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { describe } = useKinWords();
  const byId = new Map(relatives.map((x) => [x.id, x]));
  // Said from the first one picked: "Rosa is Leonor's grandmother".
  const k = kinship(relatives, b.id, a.id);
  const there = describe(k, b, a, byId);
  const back = describe(kinship(relatives, a.id, b.id), a, b, byId);
  const common =
    k.kind === "blood" && k.line === "collateral"
      ? k.ancestorIds.map((id) => byId.get(id)!.name)
      : [];
  return (
    <Panel onClose={onClose} testId="kinship-card">
      <div className="flex items-center justify-center gap-3 pr-6">
        <RelativeAvatar relative={a} size={64} />
        <span aria-hidden className="h-0.5 w-10 rounded bg-accent" />
        <RelativeAvatar relative={b} size={64} />
      </div>
      <p className="text-center text-lg leading-snug font-semibold" data-testid="kinship">
        {there.sentence}
      </p>
      {k.kind !== "none" && <p className="text-center text-sm text-muted">{back.sentence}</p>}
      {there.detail && (
        <p className="text-center text-sm">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            {there.detail}
          </span>
        </p>
      )}
      {common.length > 0 && (
        <p className="text-center text-sm text-muted">
          {t("tree.commonAncestors", { names: common.join(t("tree.and")) })}
        </p>
      )}
    </Panel>
  );
}
