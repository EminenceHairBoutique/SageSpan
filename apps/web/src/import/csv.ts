/**
 * Safe RFC 4180 CSV parser with hard limits. No eval, no regex backtracking on
 * untrusted input, no type coercion: every cell is returned as a string.
 */
export interface CsvParseOptions {
  maxRows?: number;
  maxColumns?: number;
  maxCellLength?: number;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

const DEFAULTS: Required<CsvParseOptions> = { maxRows: 5000, maxColumns: 64, maxCellLength: 2000 };

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvTable {
  const opt = { ...DEFAULTS, ...options };
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    if (field.length > opt.maxCellLength) throw new CsvError(`Cell longer than ${opt.maxCellLength} characters at row ${records.length + 1}`);
    record.push(field);
    field = "";
    if (record.length > opt.maxColumns) throw new CsvError(`More than ${opt.maxColumns} columns at row ${records.length + 1}`);
  };
  const pushRecord = () => {
    pushField();
    // skip completely empty trailing lines
    if (!(record.length === 1 && record[0] === "" )) {
      records.push(record);
      if (records.length > opt.maxRows + 1) throw new CsvError(`More than ${opt.maxRows} data rows`);
    }
    record = [];
  };
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      if (field.length === 0) {
        inQuotes = true;
        i++;
        continue;
      }
      // stray quote mid-field: treat literally
      field += ch;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRecord();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (inQuotes) throw new CsvError("Unterminated quoted field");
  if (field.length > 0 || record.length > 0) pushRecord();
  if (records.length === 0) throw new CsvError("Empty file");
  const headers = records[0]!.map((h) => h.trim());
  if (headers.some((h) => h === "")) throw new CsvError("Header row contains an empty column name");
  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) throw new CsvError(`Duplicate column name '${h}'`);
    seen.add(h);
  }
  const rows = records.slice(1).map((r, idx) => {
    if (r.length !== headers.length) throw new CsvError(`Row ${idx + 2} has ${r.length} cells but the header has ${headers.length}`);
    return r;
  });
  return { headers, rows };
}

export function csvToObjects(table: CsvTable): Record<string, string>[] {
  return table.rows.map((r) => Object.fromEntries(table.headers.map((h, i) => [h, r[i] ?? ""])));
}
