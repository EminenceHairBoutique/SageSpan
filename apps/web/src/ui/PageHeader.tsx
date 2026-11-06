import { Fragment, type ReactNode } from "react";
import { cx } from "./cx";

/**
 * Page header (design system §3.5): eyebrow, h1, lead, up to two actions and a
 * meta row ("As of … · snapshot … · method … · receipt verified"). The meta
 * items are given by the page from fields the bundle already exposes; the
 * header formats, it never derives.
 */
export function PageHeader({ eyebrow, title, lead, actions, meta, children, className, level = 1 }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode; meta?: Array<ReactNode | false | null | undefined>; children?: ReactNode; className?: string; level?: 1 | 2 }) {
  const Heading = level === 1 ? "h1" : "h2";
  const items = (meta ?? []).filter((m): m is ReactNode => m !== false && m != null && m !== "");
  return (
    <header className={cx("mb-(--stack-gap) flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="text-eyebrow uppercase text-teal">{eyebrow}</p>}
        <Heading className={cx("text-h1 text-ink", eyebrow ? "mt-1" : null)}>{title}</Heading>
        {lead && <p className="mt-2 text-body text-ink-muted">{lead}</p>}
        {items.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-faint" data-testid="page-meta">
            {items.map((item, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden="true">·</span>}
                <span>{item}</span>
              </Fragment>
            ))}
          </p>
        )}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
