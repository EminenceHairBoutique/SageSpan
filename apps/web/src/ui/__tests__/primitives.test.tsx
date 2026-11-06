import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert, Card, Chip, EmptyState, Field, KeyValue, Section, SectionHeading, Th, inputClasses } from "@/ui/primitives";

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Field", () => {
  it("marks the control invalid and links the message when error is set", () => {
    const html = render(
      <Field label="Balance (USD)" required error="Enter a decimal amount such as 1200.00">
        <input name="balance" className={inputClasses} />
      </Field>,
    );
    expect(html).toContain('aria-invalid="true"');
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described).not.toBeNull();
    const ids = (described as RegExpExecArray)[1]!.split(" ");
    for (const id of ids) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Enter a decimal amount such as 1200.00");
    expect(html).toContain('data-invalid="true"');
    expect(html).toContain("(required)");
    expect(html).toContain('aria-hidden="true"');
  });
  it("links the hint and leaves a valid control alone", () => {
    const html = render(
      <Field label="Name" hint="Shown to your household">
        <input name="label" />
      </Field>,
    );
    expect(html).not.toContain("aria-invalid");
    expect(html).toMatch(/aria-describedby="[^"]+-hint"/);
    expect(html).not.toContain("(required)");
  });
  it("uses the input boundary colour token", () => {
    expect(inputClasses).toContain("border-line-input");
    expect(inputClasses).toContain("aria-invalid:border-conflict");
    expect(inputClasses).not.toContain("focus:outline-none");
  });
});

describe("KeyValue", () => {
  it("stacks below sm and uses two columns from sm up", () => {
    const html = render(<KeyValue rows={[{ k: "Snapshot", v: "snap_1", mono: true }]} />);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-[max-content_1fr]");
    expect(html).toContain("font-mono");
  });
});

describe("Th", () => {
  it("emits scope=col by default and accepts row scope", () => {
    expect(render(<table><thead><tr><Th>Account</Th></tr></thead></table>)).toContain('scope="col"');
    expect(render(<table><tbody><tr><Th scope="row">Patel</Th></tr></tbody></table>)).toContain('scope="row"');
  });
});

describe("Alert", () => {
  it("maps tones to roles: alert for conflict, status for teal, note otherwise", () => {
    expect(render(<Alert tone="conflict" title="Blocked" />)).toContain('role="alert"');
    expect(render(<Alert tone="teal">Saved.</Alert>)).toContain('role="status"');
    expect(render(<Alert tone="amber">Limitation</Alert>)).toContain('role="note"');
    expect(render(<Alert tone="slate">Info</Alert>)).toContain('role="note"');
    expect(render(<Alert tone="amber" role="status">forced</Alert>)).toContain('role="status"');
  });
  it("renders the actions slot", () => {
    expect(render(<Alert tone="amber" actions={<button type="button">Recompute</button>}>x</Alert>)).toContain(">Recompute<");
  });
});

describe("Chip", () => {
  it("renders the history style with dashed border and the word earlier", () => {
    const html = render(<Chip tone="teal" history>Arithmetic PASS</Chip>);
    expect(html).toContain("border-dashed");
    expect(html).toContain("text-ink-faint");
    expect(html).toContain("earlier ·");
    expect(html).not.toContain("bg-teal-100");
  });
  it("keeps the tone classes otherwise", () => {
    expect(render(<Chip tone="teal">x</Chip>)).toContain("bg-teal-100 text-teal-700");
  });
});

describe("Card and Section", () => {
  it("defaults to an h2 title and accepts other heading levels, tones and density", () => {
    expect(render(<Card title="Default">b</Card>)).toContain("<h2");
    const html = render(
      <Card title="Nested" headingLevel={3} tone="amber" density="compact" footer="Footer text">
        body
      </Card>,
    );
    expect(html).toContain("<h3");
    expect(html).toContain("border-amber/40");
    expect(html).toContain('data-density="compact"');
    expect(html).toContain("Footer text");
    expect(render(<Card title="Four" headingLevel={4}>b</Card>)).toContain("<h4");
  });
  it("Section renders a heading row without elevation", () => {
    const html = render(<Section title="Inputs" headingLevel={3}>b</Section>);
    expect(html).toContain("<h3");
    expect(html).not.toContain("shadow-card");
  });
  it("SectionHeading accepts a level", () => {
    expect(render(<SectionHeading title="Page" level={1} />)).toContain("<h1");
    expect(render(<SectionHeading title="Page" />)).toContain("<h2");
  });
});

describe("EmptyState", () => {
  it("shows the reason text and an action", () => {
    const html = render(
      <EmptyState title="No check runs" reason="not-computed" action={<a href="/x">Run the check</a>}>
        Freeze a snapshot first.
      </EmptyState>,
    );
    expect(html).toContain("Not computed yet.");
    expect(html).toContain("Run the check");
    expect(html).toContain("Freeze a snapshot first.");
  });
});
