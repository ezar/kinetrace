import type { JSX } from 'react';
/**
 * Calendar heatmap of sessions.
 *
 * Twelve weeks of small squares: how often, not how hard. Rehabilitation is
 * about turning up.
 */

export interface CalendarHeatmapProps {
  /** Timestamps of completed sessions. */
  dates: readonly number[];
  weeks?: number;
  accent?: string;
  labels?: { less: string; more: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function CalendarHeatmap({
  dates,
  weeks = 12,
  accent = '#d9702f',
  labels,
}: CalendarHeatmapProps): JSX.Element {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = new Date(date).toDateString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  // Start on the Monday of the first week shown.
  const start = new Date(today.getTime() - (weeks * 7 - 1) * DAY_MS);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const columns: Array<Array<{ key: string; count: number; future: boolean }>> = [];
  for (let week = 0; week < weeks; week += 1) {
    const column: Array<{ key: string; count: number; future: boolean }> = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(start.getTime() + (week * 7 + day) * DAY_MS);
      const key = date.toDateString();
      column.push({ key, count: counts.get(key) ?? 0, future: date > today });
    }
    columns.push(column);
  }

  return (
    <div>
      <div
        className="flex gap-1"
        role="img"
        aria-label={labels ? `${labels.less} – ${labels.more}` : 'Sessions'}
      >
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-1">
            {column.map((cell) => (
              <div
                key={cell.key}
                title={cell.key}
                className="h-3.5 w-3.5 rounded-[3px] border border-line"
                style={{
                  backgroundColor: cell.future
                    ? 'transparent'
                    : cell.count === 0
                      ? '#f1ece4'
                      : accent,
                  opacity: cell.future ? 0.3 : cell.count > 1 ? 1 : cell.count === 1 ? 0.75 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
