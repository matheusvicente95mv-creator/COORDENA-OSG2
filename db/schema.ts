import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const validations = sqliteTable("validations", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull(),
  fileName: text("file_name").notNull(),
  validatedFileName: text("validated_file_name").notNull(),
  documentType: text("document_type").notNull(),
  insurer: text("insurer").notNull(),
  insured: text("insured").notNull(),
  submittedBy: text("submitted_by").notNull(),
  status: text("status").notNull(),
  score: integer("score").notNull(),
  issueCount: integer("issue_count").notNull(),
  engine: text("engine").notNull(),
  originalKey: text("original_key"),
  validatedKey: text("validated_key"),
  createdAt: text("created_at").notNull(),
});

export const billingRuns = sqliteTable("billing_runs", {
  id: text("id").primaryKey(),
  caseNumber: text("case_number").notNull(),
  insurer: text("insurer").notNull(),
  targetCents: integer("target_cents").notNull(),
  suggestedCents: integer("suggested_cents").notNull(),
  balanceCents: integer("balance_cents").notNull(),
  entriesJson: text("entries_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});
