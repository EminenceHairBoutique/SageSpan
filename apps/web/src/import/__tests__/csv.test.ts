import { describe, expect, it } from "vitest";
import { suggestColumnMapping, csvTableToImportFile, missingRequiredColumns } from "@/import/csv-contract";
import { safeCell, toCsv } from "@/import/csv-export";
import { CsvError, csvToObjects, parseCsv } from "@/import/csv";

describe("safe CSV parser", () => {
  it("parses RFC 4180 quoting, escaped quotes and CRLF", () => {
    const t = parseCsv('a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,\r\n');
    expect(t.headers).toEqual(["a", "b", "c"]);
    expect(t.rows).toEqual([
      ["1", "x, y", 'say "hi"'],
      ["2", "", ""],
    ]);
    expect(csvToObjects(t)[0]).toEqual({ a: "1", b: "x, y", c: 'say "hi"' });
  });
  it("strips a BOM and never coerces types", () => {
    const t = parseCsv("﻿v\n007\n1e3\n");
    expect(t.headers).toEqual(["v"]);
    expect(t.rows).toEqual([["007"], ["1e3"]]);
  });
  it("rejects malformed input with limits", () => {
    expect(() => parseCsv('a\n"unterminated')).toThrow(CsvError);
    expect(() => parseCsv("a,a\n1,2")).toThrow(/Duplicate/);
    expect(() => parseCsv("a,b\n1")).toThrow(/has 1 cells/);
    expect(() => parseCsv("a\n1\n2\n3", { maxRows: 2 })).toThrow(/More than 2 data rows/);
    expect(() => parseCsv("a,b,c\n1,2,3", { maxColumns: 2 })).toThrow(/More than 2 columns/);
    expect(() => parseCsv("")).toThrow(/Empty/);
  });
});

describe("formula-injection-safe export", () => {
  it("neutralises cells that spreadsheets would evaluate", () => {
    expect(safeCell("=1+1")).toBe("\"'=1+1\"");
    expect(safeCell("+cmd|' /C calc'!A0")).toBe("\"'+cmd|' /C calc'!A0\"");
    expect(safeCell("-5")).toBe("\"'-5\"");
    expect(safeCell("@SUM(A1)")).toBe("\"'@SUM(A1)\"");
    expect(safeCell("\tx")).toBe("\"'\tx\"");
    expect(safeCell("plain")).toBe("plain");
    expect(safeCell('a "quoted", value')).toBe('"a ""quoted"", value"');
    expect(safeCell(null)).toBe("");
  });
  it("writes CRLF rows with a header", () => {
    expect(toCsv(["a", "b"], [["1", "=x"]])).toBe("a,b\r\n1,\"'=x\"\r\n");
  });
});

describe("CSV column contract", () => {
  it("auto-suggests mapping from contract headers and reports missing required columns", () => {
    const m = suggestColumnMapping(["Record Type", "subject_ref", "VALUE", "as-of date", "note"]);
    expect(m.record_type).toBe("Record Type");
    expect(m.value).toBe("VALUE");
    expect(m.as_of_date).toBe("as-of date");
    expect(missingRequiredColumns(m)).toEqual([]);
    expect(missingRequiredColumns(suggestColumnMapping(["Client", "Balance"]))).toEqual(["record_type", "subject_ref", "value", "as_of_date"]);
  });
  it("converts rows and reports row-level errors without guessing", () => {
    const table = parseCsv("record_type,subject_type,subject_ref,subject_label,field_key,value_kind,value,currency,unit,as_of_date,tax_year,source_location,note\nACCOUNT,ACCOUNT,ira1,IRA,account_type,TEXT,TRADITIONAL_IRA,,,2026-01-01,,,\nFACT,ACCOUNT,ira1,,account.year_end_balance,NUMBER,100.00,USD,,2025-12-31,,,\n");
    const bad = csvTableToImportFile(table, suggestColumnMapping(table.headers), { source_kind: "PLAN_EXPORT", household_ref: "h", vendor_label: null, export_as_of: "2026-01-01", tax_year: 2026 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/owner_ref/);
    const table2 = parseCsv("record_type,subject_type,subject_ref,subject_label,field_key,value_kind,value,currency,unit,as_of_date,tax_year,source_location,note\nPERSON,PERSON,o,Owner,role_in_household,TEXT,PRIMARY,,,2026-01-01,,,\nACCOUNT,ACCOUNT,ira1,IRA,account_type,TEXT,TRADITIONAL_IRA,,,2026-01-01,,,owner_ref=o\nFACT,ACCOUNT,ira1,,account.year_end_balance,NUMBER,100.00,USD,,2025-12-31,,,\n");
    const good = csvTableToImportFile(table2, suggestColumnMapping(table2.headers), { source_kind: "PLAN_EXPORT", household_ref: "h", vendor_label: null, export_as_of: "2026-01-01", tax_year: 2026 });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.file.accounts[0]?.owner_ref).toBe("o");
      expect(good.file.facts[0]?.value).toBe("100.00");
    }
  });
});
