import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { Td, Th } from "./primitives";

/**
 * Accessible data table (design system §3.8): a `<caption>`, `scope="col"`
 * headers, right-aligned tabular money cells, and a labelled, focusable
 * horizontal scroll region so keyboard users can reach every column.
 * Status cells use typed chips; money strings come from `formatMoney`. The
 * table renders what it is given and never sorts, sums or compares amounts.
 */
export type TableMinWidth = "none" | "sm" | "md" | "lg";

const minWidthClass: Record<TableMinWidth, string> = {
  none: "",
  sm: "min-w-(--table-min-sm)",
  md: "min-w-(--table-min-md)",
  lg: "min-w-(--table-min-lg)",
};

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row, index: number) => ReactNode;
  /** Money and counts: right-aligned, tabular numerals. */
  align?: "left" | "right";
  money?: boolean;
  /** Renders the cell as `<th scope="row">` (the entity the row describes). */
  rowHeader?: boolean;
  className?: string;
  headerClassName?: string;
}

/** Labelled, focusable horizontal scroll region with edge fades. */
export function TableRegion({ label, children, className, minWidth = "sm" }: { label: string; children: ReactNode; className?: string; minWidth?: TableMinWidth }) {
  const hintId = useId();
  return (
    <div role="region" aria-label={label} aria-describedby={hintId} tabIndex={0} className={cx("scroll-x-fade overflow-x-auto rounded-control border border-line", className)}>
      <span id={hintId} className="sr-only">
        Scroll horizontally to see more columns.
      </span>
      <div className={minWidthClass[minWidth]}>{children}</div>
    </div>
  );
}

export function DataTable<Row>({ caption, captionVisible = false, columns, rows, rowKey, minWidth = "sm", emptyMessage = "Nothing to show.", className, rowClassName, dense }: { caption: string; captionVisible?: boolean; columns: Array<DataTableColumn<Row>>; rows: Row[]; rowKey: (row: Row, index: number) => string; minWidth?: TableMinWidth; emptyMessage?: ReactNode; className?: string; rowClassName?: (row: Row, index: number) => string | undefined; dense?: boolean }) {
  return (
    <TableRegion label={caption} minWidth={minWidth} className={className}>
      <table className={cx("w-full border-collapse bg-surface", dense ? "text-body-dense" : "text-sm")}>
        <caption className={captionVisible ? "px-3 py-2 text-left text-support text-ink-muted" : "sr-only"}>{caption}</caption>
        <thead className="border-b border-line bg-surface-muted/60">
          <tr>
            {columns.map((c) => (
              <Th key={c.key} align={c.align === "right" || c.money ? "right" : undefined} className={c.headerClassName}>
                {c.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && (
            <tr>
              <Td colSpan={columns.length} className="text-center text-ink-muted">
                {emptyMessage}
              </Td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className={rowClassName?.(row, i)}>
              {columns.map((c) => {
                const right = c.align === "right" || c.money;
                if (c.rowHeader) {
                  return (
                    <Th key={c.key} scope="row" className={cx("px-3 py-(--row-padding-y) align-top font-medium normal-case tracking-normal text-sm text-ink", right && "text-right tabular", c.className)}>
                      {c.cell(row, i)}
                    </Th>
                  );
                }
                return (
                  <Td key={c.key} align={right ? "right" : undefined} className={cx(c.money && "font-medium whitespace-nowrap", c.className)}>
                    {c.cell(row, i)}
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableRegion>
  );
}
