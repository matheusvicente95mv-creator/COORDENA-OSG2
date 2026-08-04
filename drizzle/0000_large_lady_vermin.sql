CREATE TABLE `billing_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_number` text NOT NULL,
	`insurer` text NOT NULL,
	`target_cents` integer NOT NULL,
	`suggested_cents` integer NOT NULL,
	`balance_cents` integer NOT NULL,
	`entries_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `validations` (
	`id` text PRIMARY KEY NOT NULL,
	`case_number` text NOT NULL,
	`file_name` text NOT NULL,
	`validated_file_name` text NOT NULL,
	`document_type` text NOT NULL,
	`insurer` text NOT NULL,
	`insured` text NOT NULL,
	`submitted_by` text NOT NULL,
	`status` text NOT NULL,
	`score` integer NOT NULL,
	`issue_count` integer NOT NULL,
	`engine` text NOT NULL,
	`original_key` text,
	`validated_key` text,
	`created_at` text NOT NULL
);
