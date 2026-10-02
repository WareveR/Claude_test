import { addDays, type PlainDate } from "./plain-date";

/** Places overlapping blocks of one day side by side: each gets a lane and the lane count. */
export function layoutLanes<T extends { start: number; end: number }>(
  blocks: T[],
): (T & { lane: number; lanes: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: (T & { lane: number; lanes: number })[] = [];
  let cluster: (T & { lane: number; lanes: number })[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1));
    for (const b of cluster) b.lanes = lanes;
    result.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
  };

  for (const block of sorted) {
    if (block.start >= clusterEnd && cluster.length > 0) closeCluster();
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = block.end;
    cluster.push({ ...block, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, block.end);
  }
  if (cluster.length > 0) closeCluster();
  return result;
}

/**
 * Lays multi-day bars (All-day Entries, Checklist periods) over a row of days: each bar gets
 * its first column, how many columns it spans and a row so bars never overlap.
 */
export function layoutBars<T extends { startDate: PlainDate; endDate: PlainDate }>(
  bars: T[],
  firstDay: PlainDate,
  days: number,
): (T & { column: number; span: number; row: number })[] {
  const lastDay = addDays(firstDay, days - 1);
  const visible = bars
    .filter((b) => b.startDate <= lastDay && b.endDate >= firstDay)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate));
  const rowEnds: PlainDate[] = [];
  return visible.map((bar) => {
    const from = bar.startDate < firstDay ? firstDay : bar.startDate;
    const to = bar.endDate > lastDay ? lastDay : bar.endDate;
    let row = rowEnds.findIndex((end) => end < from);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = to;
    return { ...bar, column: dayIndex(firstDay, from), span: dayIndex(from, to) + 1, row };
  });
}

function dayIndex(from: PlainDate, to: PlainDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
