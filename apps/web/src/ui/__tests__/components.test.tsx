import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataTable, TableRegion } from "@/ui/DataTable";
import { PageHeader } from "@/ui/PageHeader";
import { SERVICE_STATE_COPY, ServiceState } from "@/ui/ServiceState";
import { Loading, Skeleton, SkeletonStat } from "@/ui/Skeleton";
import { Stat } from "@/ui/personal/components";
import { Checkpoints } from "@/ui/console/Checkpoints";

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("PageHeader", () => {
  it("renders eyebrow, h1, lead, actions and a meta row when a run exists", () => {
    const html = render(<PageHeader eyebrow="Personal" title="Where you stand, Maya" lead="Your numbers as of today." actions={<a href="/x">Recompute</a>} meta={["As of 2026-11-06", <span key="s">snapshot snap_1</span>, "method personal.cashflow_baseline@2026.1", null, false, "receipt verified"]} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Where you stand, Maya");
    expect(html).toContain("Personal");
    expect(html).toContain("Your numbers as of today.");
    expect(html).toContain(">Recompute<");
    expect(html).toContain('data-testid="page-meta"');
    expect(html.match(/aria-hidden="true">·</g)?.length).toBe(3);
    expect(html).toContain("receipt verified");
  });
  it("omits the meta row without a run and can render as h2", () => {
    const html = render(<PageHeader title="Review queue" level={2} />);
    expect(html).toContain("<h2");
    expect(html).not.toContain("page-meta");
    expect(render(<PageHeader title="Empty meta" meta={[null, undefined, false, ""]} />)).not.toContain("page-meta");
  });
});

describe("DataTable", () => {
  type Row = { id: string; label: string; amount: string; when: string };
  const rows: Row[] = [
    { id: "a", label: "Patel household", amount: "$25,098.04", when: "2026-11-06" },
    { id: "b", label: "Okafor household", amount: "$0.00", when: "2026-11-05" },
  ];
  const columns = [
    { key: "label", header: "Household", cell: (r: Row) => r.label, rowHeader: true },
    { key: "when", header: "Updated", cell: (r: Row) => <time dateTime={r.when}>{r.when}</time> },
    { key: "amount", header: "Annual RMD", cell: (r: Row) => r.amount, money: true },
  ];
  it("has a caption, column scopes, a row header and a labelled focusable scroll region", () => {
    const html = render(<DataTable caption="Review queue, as of 2026-11-06" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).toContain("<caption");
    expect(html).toContain("Review queue, as of 2026-11-06");
    expect(html.match(/scope="col"/g)?.length).toBe(3);
    expect(html.match(/scope="row"/g)?.length).toBe(2);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Review queue, as of 2026-11-06"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Scroll horizontally to see more columns.");
    expect(html).toContain("min-w-(--table-min-sm)");
  });
  it("right-aligns money cells with tabular numerals and shows the empty message", () => {
    const html = render(<DataTable caption="t" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).toMatch(/<td[^>]*text-right tabular[^>]*>\$25,098\.04<\/td>/);
    expect(html.match(/<th[^>]*text-right/g)?.length).toBe(1);
    expect(render(<DataTable caption="t" columns={columns} rows={[]} rowKey={(r) => r.id} emptyMessage="No households" />)).toContain("No households");
  });
  it("TableRegion exposes the hint via aria-describedby", () => {
    const html = render(
      <TableRegion label="Facts">
        <table />
      </TableRegion>,
    );
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });
});

describe("ServiceState", () => {
  it("renders the three variants with their tones and roles", () => {
    const calc = render(<ServiceState kind="calculator-unreachable" detail="Last tried 09:12 UTC." action={<button type="button">Retry</button>} />);
    expect(calc).toContain('role="alert"');
    expect(calc).toContain("bg-conflict-100");
    expect(calc).toContain(SERVICE_STATE_COPY["calculator-unreachable"].title);
    expect(calc).toContain("Last tried 09:12 UTC.");
    expect(calc).toContain(">Retry<");
    const ai = render(<ServiceState kind="ai-offline-mock" />);
    expect(ai).toContain('role="note"');
    expect(ai).toContain("bg-slate-100");
    expect(ai).toContain("deterministic offline mock");
    const store = render(<ServiceState kind="store-not-wired" />);
    expect(store).toContain('role="note"');
    expect(store).toContain("bg-amber-100");
    expect(store).toContain("Production data store not wired");
  });
});

describe("Skeleton and Stat", () => {
  it("skeletons are hidden from assistive tech, stop under reduced motion, and the group announces once", () => {
    const html = render(
      <Loading>
        <Skeleton shape="row" />
        <SkeletonStat label="Liquid cash" />
      </Loading>,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading…");
    expect(html).toContain("motion-reduce:animate-none");
    expect(html.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("Liquid cash");
  });
  it("Stat shows a textual qualifier with the tone rule and a skeleton while loading", () => {
    const html = render(
      <Stat label="Liquid cash" tone="conflict" qualifier="below your floor" hint="as of 2026-11-06">
        $1,200.00
      </Stat>,
    );
    expect(html).toContain("below your floor");
    expect(html).toContain("border-l-[3px]");
    expect(html).toContain("border-l-conflict");
    expect(html).toContain("$1,200.00");
    const loading = render(
      <Stat label="Liquid cash" loading>
        ignored
      </Stat>,
    );
    expect(loading).toContain("animate-pulse");
    expect(loading).not.toContain("ignored");
  });
});

describe("Checkpoints", () => {
  it("marks the furthest reached checkpoint as the current step and keeps 12 px text", () => {
    const html = render(<Checkpoints status="FROZEN" />);
    expect(html.match(/aria-current="step"/g)?.length).toBe(1);
    expect(html).toMatch(/aria-current="step"[^]*?Frozen/);
    expect(html).not.toContain("text-[10px]");
    expect(html).toContain("text-caption");
    expect(html).toContain("(current)");
  });
  it("has no current step before import", () => {
    expect(render(<Checkpoints status="IMPORT_DRAFT" />)).not.toContain('aria-current="step"');
  });
});
