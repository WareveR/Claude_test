import {
  Backpack,
  Clock,
  Flower2,
  Heart,
  Leaf,
  Moon,
  Snowflake,
  Sparkles,
  Sprout,
  Sun,
  Sunrise,
  Trash2,
  type LucideIcon,
} from "lucide-react";

/**
 * The coloured line icon for each glyph a Calendar Layer note starts with. Moon phases keep
 * their glyphs, which show the phase better than any line icon.
 */
const ICONS: Record<string, [LucideIcon, string]> = {
  "🎒": [Backpack, "#f97316"],
  "🌙": [Moon, "#8b5cf6"],
  "🌿": [Sprout, "#22c55e"],
  "🕑": [Clock, "#0ea5e9"],
  "💝": [Heart, "#ec4899"],
  "✨": [Sparkles, "#eab308"],
  "🌅": [Sunrise, "#f59e0b"],
  "🗑️": [Trash2, "#64748b"],
  "🌸": [Flower2, "#ec4899"],
  "☀️": [Sun, "#f59e0b"],
  "🍂": [Leaf, "#ea580c"],
  "❄️": [Snowflake, "#38bdf8"],
};

/** A Calendar Layer note line, its leading glyph drawn as a coloured icon where there is one. */
export function NoteLine({ note, size = 12 }: { note: string; size?: number }) {
  const space = note.indexOf(" ");
  const entry = space > 0 ? ICONS[note.slice(0, space)] : undefined;
  if (!entry) return <>{note}</>;
  const [Component, color] = entry;
  return (
    <>
      <Component
        aria-hidden
        size={size}
        strokeWidth={2}
        color={color}
        className="mr-0.5 inline-block align-[-0.125em]"
      />
      {note.slice(space + 1)}
    </>
  );
}
