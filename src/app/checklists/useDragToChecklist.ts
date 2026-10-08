import { usePointerDrag } from "../ui/usePointerDrag";

const TASK_LINK = '[data-testid="task"] a[href^="/tasks/"]';
const DROP = "[data-drop-checklist]";

/**
 * Dragging a loose Task's row onto a Checklist row, with mouse or touch. Drop targets carry
 * `data-drop-checklist` with the Checklist's id.
 */
export function useDragToChecklist(onDrop: (taskId: string, checklistId: string) => void) {
  return usePointerDrag<string, string>({
    pick: (target) => {
      const link = target.closest(TASK_LINK);
      return link ? link.getAttribute("href")!.slice("/tasks/".length) : null;
    },
    locate: (x, y) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>(DROP)?.dataset.dropChecklist ?? null,
    onDrop,
  });
}
