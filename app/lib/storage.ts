import type { ValidationReport } from "./validation";

type RuntimeBindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
};

async function bindings() {
  try {
    const cloudflare = await import("cloudflare:workers");
    return cloudflare.env as unknown as RuntimeBindings;
  } catch {
    return {} as RuntimeBindings;
  }
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db
      .prepare(`CREATE TABLE IF NOT EXISTS validations (
        id TEXT PRIMARY KEY,
        case_number TEXT NOT NULL,
        file_name TEXT NOT NULL,
        validated_file_name TEXT NOT NULL,
        document_type TEXT NOT NULL,
        insurer TEXT NOT NULL,
        insured TEXT NOT NULL,
        submitted_by TEXT NOT NULL,
        status TEXT NOT NULL,
        score INTEGER NOT NULL,
        issue_count INTEGER NOT NULL,
        engine TEXT NOT NULL,
        original_key TEXT,
        validated_key TEXT,
        created_at TEXT NOT NULL
      )`),
    db
      .prepare(`CREATE TABLE IF NOT EXISTS billing_runs (
        id TEXT PRIMARY KEY,
        case_number TEXT NOT NULL,
        insurer TEXT NOT NULL,
        target_cents INTEGER NOT NULL,
        suggested_cents INTEGER NOT NULL,
        balance_cents INTEGER NOT NULL,
        entries_json TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS validations_created_at_idx ON validations (created_at DESC)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS billing_runs_created_at_idx ON billing_runs (created_at DESC)",
    ),
  ]);
}

function safePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export async function persistValidation(input: {
  id: string;
  caseNumber: string;
  fileName: string;
  validatedFileName: string;
  documentType: string;
  insurer: string;
  insured: string;
  submittedBy: string;
  report: ValidationReport;
  originalBytes: Uint8Array;
  validatedBytes: Uint8Array;
}) {
  const { DB, BUCKET } = await bindings();
  let originalKey: string | null = null;
  let validatedKey: string | null = null;

  if (BUCKET) {
    const folder = `validations/${safePart(input.caseNumber)}/${input.id}`;
    originalKey = `${folder}/original-${safePart(input.fileName)}`;
    validatedKey = `${folder}/${safePart(input.validatedFileName)}`;
    await Promise.all([
      BUCKET.put(originalKey, input.originalBytes, {
        httpMetadata: {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }),
      BUCKET.put(validatedKey, input.validatedBytes, {
        httpMetadata: {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      }),
    ]);
  }

  if (DB) {
    await ensureSchema(DB);
    await DB.prepare(
      `INSERT INTO validations (
        id, case_number, file_name, validated_file_name, document_type,
        insurer, insured, submitted_by, status, score, issue_count, engine,
        original_key, validated_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        input.id,
        input.caseNumber,
        input.fileName,
        input.validatedFileName,
        input.documentType,
        input.insurer,
        input.insured,
        input.submittedBy,
        input.report.recommendation,
        input.report.score,
        input.report.findings.length,
        input.report.engine,
        originalKey,
        validatedKey,
        new Date().toISOString(),
      )
      .run();
  }

  return { originalKey, validatedKey };
}

export async function listValidations() {
  const { DB } = await bindings();
  if (!DB) return [];
  await ensureSchema(DB);
  const result = await DB.prepare(
    `SELECT
      id,
      case_number AS caseNumber,
      file_name AS fileName,
      validated_file_name AS validatedFileName,
      document_type AS documentType,
      insurer,
      insured,
      submitted_by AS submittedBy,
      status,
      score,
      issue_count AS issueCount,
      engine,
      created_at AS createdAt
    FROM validations
    ORDER BY created_at DESC
    LIMIT 50`,
  ).all();
  return result.results;
}

export async function persistBillingRun(input: {
  id: string;
  caseNumber: string;
  insurer: string;
  targetCents: number;
  suggestedCents: number;
  balanceCents: number;
  entries: unknown;
  createdBy: string;
}) {
  const { DB } = await bindings();
  if (!DB) return false;
  await ensureSchema(DB);
  await DB.prepare(
    `INSERT INTO billing_runs (
      id, case_number, insurer, target_cents, suggested_cents,
      balance_cents, entries_json, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      input.id,
      input.caseNumber,
      input.insurer,
      input.targetCents,
      input.suggestedCents,
      input.balanceCents,
      JSON.stringify(input.entries),
      input.createdBy,
      new Date().toISOString(),
    )
    .run();
  return true;
}

export async function getStoredFile(key: string) {
  const { BUCKET } = await bindings();
  if (!BUCKET) return null;
  return BUCKET.get(key);
}
