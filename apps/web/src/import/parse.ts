import { IMPORT_LIMITS, ImportFileSchema, type ImportFile } from "@sagespan/contracts";
import { CsvError, parseCsv, type CsvTable } from "./csv";
import { missingRequiredColumns, suggestColumnMapping, type ColumnMapping } from "./csv-contract";

/**
 * Upload inspection and parsing. Only two explicitly supported formats exist:
 * `sagespan.import.v1` JSON and the documented CSV column contract. Anything
 * else produces an actionable rejection, never a best-effort parse.
 */
export interface UploadMeta {
  filename: string;
  mimeType: string;
  byteLength: number;
}

export type ParsedUpload =
  | { kind: "JSON"; file: ImportFile }
  | { kind: "CSV"; table: CsvTable; suggestedMapping: ColumnMapping; missingRequired: string[] };

export class UnsupportedImportError extends Error {
  constructor(
    message: string,
    public readonly hints: string[],
  ) {
    super(message);
    this.name = "UnsupportedImportError";
  }
}

const TEMPLATE_HINT = "Download a supported template from the Imports page (sagespan.import.v1 JSON or CSV) and map your export to it.";

export function validateUpload(meta: UploadMeta): "JSON" | "CSV" {
  if (meta.byteLength === 0) throw new UnsupportedImportError("The file is empty.", [TEMPLATE_HINT]);
  if (meta.byteLength > IMPORT_LIMITS.maxBytes) {
    throw new UnsupportedImportError(`The file is ${(meta.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${IMPORT_LIMITS.maxBytes / 1024 / 1024} MB.`, ["Split the export or remove unrelated households."]);
  }
  const lower = meta.filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (!IMPORT_LIMITS.allowedExtensions.includes(ext as ".csv" | ".json")) {
    throw new UnsupportedImportError(`'${ext || "(no extension)"}' files are not supported. Supported: .csv and .json in the documented contract.`, [
      "PDF statements, spreadsheets (.xlsx) and vendor-native exports are not parsed in this build; nothing is OCR'd or guessed.",
      TEMPLATE_HINT,
    ]);
  }
  if (meta.mimeType && !IMPORT_LIMITS.allowedMimeTypes.includes(meta.mimeType as (typeof IMPORT_LIMITS.allowedMimeTypes)[number])) {
    throw new UnsupportedImportError(`Unexpected content type '${meta.mimeType}'.`, [TEMPLATE_HINT]);
  }
  return ext === ".json" ? "JSON" : "CSV";
}

export function parseUploadText(format: "JSON" | "CSV", text: string): ParsedUpload {
  if (format === "JSON") {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new UnsupportedImportError("The file is not valid JSON.", [TEMPLATE_HINT]);
    }
    const parsed = ImportFileSchema.safeParse(json);
    if (!parsed.success) {
      const version = (json as { schema_version?: unknown })?.schema_version;
      const issues = parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      throw new UnsupportedImportError(
        version === "sagespan.import.v1" ? "The JSON file does not match the sagespan.import.v1 contract." : `Unsupported JSON schema${typeof version === "string" ? ` '${version}'` : ""}. Only sagespan.import.v1 is accepted.`,
        [...issues, TEMPLATE_HINT],
      );
    }
    return { kind: "JSON", file: parsed.data };
  }
  let table: CsvTable;
  try {
    table = parseCsv(text, { maxRows: IMPORT_LIMITS.maxRows, maxColumns: IMPORT_LIMITS.maxColumns });
  } catch (e) {
    throw new UnsupportedImportError(`The CSV could not be parsed: ${e instanceof CsvError ? e.message : "unknown error"}.`, [TEMPLATE_HINT]);
  }
  const suggestedMapping = suggestColumnMapping(table.headers);
  const missingRequired = missingRequiredColumns(suggestedMapping);
  return { kind: "CSV", table, suggestedMapping, missingRequired };
}
