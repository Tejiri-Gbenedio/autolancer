# AutoLancer Checkpoint

Last updated: 2026-07-01

## Current Goal

Build AutoLancer as a production SaaS intake portal, with the frontend feeding a validated lead contract into Supabase first, then n8n.

## Completed So Far

- Premium static Netlify frontend is in place.
- Supabase frontend client is configured through `supabase.js`.
- Public runtime Supabase config is served through `netlify/functions/config.js`.
- n8n handoff is implemented in `netlify/functions/notify-n8n.js`.
- Lead validation and normalization contract exists in `lib/lead-schema.js`.
- Verification script exists at `scripts/verify-lead-schema.js`.
- `npm run verify:lead-schema` has passed previously.

## Canonical Lead Contract

`lib/lead-schema.js` is the single source of truth.

Current `leads` table fields from `CURRENT_LEADS_TABLE_FIELDS`:

- `lead_id`
- `created_at`
- `updated_at`
- `full_name`
- `email`
- `phone`
- `project_type`
- `budget_range`
- `timeline`
- `source`
- `description`
- `existing_tools`
- `website_url`
- `intake_channel`
- `status`
- `n8n_status`

Enums:

- `project_type`: `automation`, `web_development`, `chatbot`, `integration`, `other`
- `budget_range`: `under_500`, `500_1000`, `1000_3000`, `3000_plus`
- `timeline`: `1_week`, `2_weeks`, `1_month`, `flexible`
- `source`: `linkedin`, `referral`, `twitter`, `google`, `other`, `unknown`
- `status`: `new`, `qualified`, `proposal_pending`, `proposal_sent`, `accepted`, `invoiced`, `paid`, `archived`
- `n8n_status`: `pending`, `delivered`, `failed`

Future fields are validated by the contract but intentionally not inserted into the current `leads` table yet:

- `file_uploads`
- `ai_score`
- `ai_summary`
- `proposal_id`
- `invoice_id`
- `payment_status`
- `user_id`

## Completed In Latest Turn

`supabase/leads.sql` was updated as a production-ready migration for the `leads` table only.

The migration now:

- Matches `CURRENT_LEADS_TABLE_FIELDS`.
- Includes operational n8n status fields used by the Netlify function:
  - `n8n_last_error`
  - `n8n_delivered_at`
- Uses PostgreSQL constraints for required fields, lengths, normalized email, phone, URL, and enums.
- Adds indexes for `status`, `email`, `created_at`, `project_type`, and `n8n_status`.
- Adds composite workflow indexes for `(status, created_at desc)` and `(n8n_status, created_at desc)`.
- Enables RLS.
- Allows anonymous public inserts only for safe web form payloads.
- Prevents public select, update, and delete.
- Uses the service role only from server-side Netlify functions for n8n status updates.
- Adds an `updated_at` trigger for future server/admin updates.

`npm run verify:lead-schema` passed after this change.

## Latest Follow-Up Migration

The user ran the initial migration successfully in Supabase.

Added follow-up migration:

- `supabase/migrations/20260701030000_harden_public_lead_inserts.sql`

This migration:

- Adds nullable `workspace_id uuid` to `public.leads`.
- Adds `public.generate_lead_id()` for server-side lead ID defaults.
- Adds insert preparation function/trigger so public-submitted workflow state is overwritten before RLS checks.
- Keeps the existing RLS policy name:
  - `Public can submit lead intake records`
- Ensures public inserts end as:
  - `status = 'new'`
  - `n8n_status = 'pending'`
  - database-generated `created_at`
  - database-generated `updated_at`
  - generated `lead_id` when not provided.

## Latest Environment Handling Fix

The form error `"Missing Supabase or n8n environment variables."` came from:

- `netlify/functions/notify-n8n.js`

The lead is saved by the frontend first through:

- `supabase.js`

Changed behavior:

- Missing `N8N_WEBHOOK_URL` no longer blocks the confirmation flow.
- The Netlify handoff function returns `200` with a warning when n8n is not configured.
- Supabase insert remains the source-of-truth step and still happens before n8n handoff.
- Missing server-side status update config no longer turns an already-saved lead into a failed user submission.

## Next Suggested Task

Review the generated SQL in Supabase SQL Editor, run it against the Supabase project, then submit a test lead through the Netlify/local frontend and confirm:

- The row is inserted in `public.leads`.
- Public users cannot select rows.
- The Netlify n8n function updates `n8n_status` using the server-side service role.

## Important Safety Notes

- Do not commit `.env`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- Do not create Supabase tables yet unless the user explicitly asks to run the migration.
- Keep `logo/` untouched unless the user asks.
- Current branch is `main`.
