import { Icon } from "../ui/Icon";
import type { EntryType } from "./model";

/** An Entry Type's thumbnail, or its icon on its colour. */
export function EntryTypeBadge({
  type,
  size = 32,
}: {
  type: Pick<EntryType, "color" | "icon" | "thumbnailKey">;
  size?: number;
}) {
  if (type.thumbnailKey) {
    return (
      <img
        src={`/api/images/${type.thumbnailKey}`}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-md object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: type.color }}
      className="inline-flex shrink-0 items-center justify-center rounded-md text-white"
    >
      <Icon name={type.icon} size={size * 0.6} />
    </span>
  );
}
