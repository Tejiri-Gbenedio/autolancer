# AutoLancer

AutoLancer is a public project intake experience for an AI-assisted freelance pipeline. The current repository ships the client-facing lead form, frontend validation, Supabase persistence, and an n8n handoff function. The broader product roadmap also covers Telegram intake, Qwen-based lead scoring and proposal generation, approval workflows, onboarding, and payment automation, but those stages are still planned rather than built in this repo today.

This README is the source of truth for the current implementation and the immediate roadmap.

## Project overview

The public website has one job: let a prospect submit a project brief in a premium, trustworthy interface without exposing internal pipeline mechanics. When someone submits the form:

1. The browser validates and normalizes the lead against the shared schema in [`lib/lead-schema.js`](./lib/lead-schema.js).
2. The browser inserts the lead into Supabase through the public anon or publishable key.
3. The browser sends the same normalized payload to a Netlify Function.
4. The Netlify Function forwards the payload to n8n when `N8N_WEBHOOK_URL` is configured.
5. The Netlify Function updates `n8n_status` in Supabase to `delivered`, `failed`, or leaves it `pending`.

If the n8n handoff is unavailable, the lead still remains stored in Supabase and the user still gets a success screen.

## Current architecture

### Frontend

- Static HTML, CSS, and browser JavaScript served from the repo root.
- `index.html` renders the public intake experience and success state.
- `styles.css` contains the full visual system and responsive layout.
- `app.js` owns client-side validation, submission flow, loading states, success UI, and duplicate-submit protection.
- `config.js` loads runtime configuration from a Netlify Function so browser code never reads secrets directly.
- `supabase.js` creates the browser Supabase client with the public key only.
- `helpers.js` contains small shared utilities.

### Backend pipeline surface in this repo

- `netlify/functions/config.js` exposes only public Supabase runtime config to the browser.
- `netlify/functions/notify-n8n.js` validates the normalized lead, posts it to n8n, and updates `n8n_status` in Supabase through the service role key.
- `lib/lead-schema.js` is the canonical lead contract used by the frontend, Supabase inserts, and n8n handoff.
- `scripts/verify-lead-schema.js` is the contract smoke test.

### External systems

- Supabase is the source of truth for submitted leads.
- Netlify hosts the static site and serverless functions.
- n8n is the next-step orchestration layer for downstream automation.
- Qwen AI is planned for later lead scoring, proposal generation, and conversational intake.

## Tech stack

### Shipped now

- HTML5
- CSS3
- Vanilla JavaScript with ES modules
- Netlify Functions
- Supabase JavaScript client `@supabase/supabase-js@2.110.0`
- Netlify deployment

### Planned in the roadmap

- n8n orchestration
- Qwen Cloud on Alibaba Cloud
- Telegram Bot API
- Airtable
- Gmail via n8n
- Flutterwave
- Google Sheets logging

## Folder structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- config.js
|-- helpers.js
|-- supabase.js
|-- autolancer-lead-form.html
|-- AutoLancer_Build_Plan.pdf
|-- lib/
|   `-- lead-schema.js
|-- netlify/
|   `-- functions/
|       |-- config.js
|       `-- notify-n8n.js
|-- n8n/
|   |-- lead-normalizer-function.js
|   |-- sample-web-form-payload.json
|   `-- sample-telegram-payload.json
|-- scripts/
|   `-- verify-lead-schema.js
|-- supabase/
|   |-- leads.sql
|   `-- migrations/
|       |-- 20260701030000_harden_public_lead_inserts.sql
|       `-- 20260702090000_add_select_label_value_payload.sql
|-- .env.example
|-- netlify.toml
|-- package.json
`-- package-lock.json
```

## Frontend

The frontend is intentionally lightweight:

- No framework build step is required.
- `index.html` imports `app.js` directly as a module.
- Supabase is loaded via an import map pointing to `esm.sh`.
- The success screen is part of the same page and swaps in after submission.

### UX goals

- Premium dark-mode SaaS presentation
- Strong hierarchy and minimal copy
- No public exposure of backend workflow internals
- Accessible labels, focus states, and keyboard support
- Responsive layout across desktop, tablet, and mobile

### Public form fields currently rendered

These are the fields visible in the public intake form today:

- `full_name`
- `email`
- `project_type`
- `budget_range`
- `timeline`
- `source`
- `description`
- `existing_tools`

The shared lead contract also reserves optional fields such as `phone` and `website_url` for future channels or later UI expansion, but they are not rendered in the current public form.

Select fields submit both the visible human label and the machine value used by automation. For example, `project_type` stores `Website / web app`, while `project_type_value` stores `web_development`. The hidden intake channel follows the same pattern with `intake_channel` as `Web Form` and `intake_channel_value` as `web_form`.

## Backend pipeline

The repository does not yet contain the full downstream automation workflow, but it already preserves compatibility for that planned pipeline.

### Current flow

1. User submits the website form.
2. Browser validation runs with `validateLead`.
3. Browser insert runs with `validateLeadForSupabase`.
4. Supabase stores the lead in `public.leads`.
5. Browser calls `/.netlify/functions/notify-n8n`.
6. The Netlify Function validates again with `validateLeadForHandoff`.
7. If `N8N_WEBHOOK_URL` exists, the function forwards the same payload to n8n.
8. The function writes `n8n_status` back to Supabase using the service role key.

### Canonical lead payload

The normalized payload shape used by the current browser and function layers is:

```json
{
  "lead_id": "lead_20260622093000_demo001",
  "created_at": "2026-06-22T09:30:00.000Z",
  "updated_at": "2026-06-22T09:30:00.000Z",
  "full_name": "Jane Doe",
  "email": "jane@company.com",
  "phone": null,
  "project_type": "Automation / workflow",
  "project_type_value": "automation",
  "budget_range": "$1,000 - $3,000",
  "budget_range_value": "1000_3000",
  "timeline": "Within 2 weeks",
  "timeline_value": "2_weeks",
  "source": "LinkedIn",
  "source_value": "linkedin",
  "description": "Project brief...",
  "existing_tools": "Airtable, Gmail",
  "website_url": null,
  "intake_channel": "Web Form",
  "intake_channel_value": "web_form",
  "status": "new",
  "n8n_status": "pending"
}
```

The actual Supabase insert and n8n handoff are restricted to the fields in `CURRENT_LEADS_TABLE_FIELDS` from [`lib/lead-schema.js`](./lib/lead-schema.js).

## n8n workflow order

### What exists now

- `n8n/lead-normalizer-function.js` can normalize incoming webhook or bot payloads into the shared lead structure.
- `n8n/sample-web-form-payload.json` shows the web payload shape.
- `n8n/sample-telegram-payload.json` shows an example alternate-channel payload.

### Planned workflow order from the build plan

1. Lead intake from web form
2. Telegram bot intake
3. Data normalization into a shared schema
4. Qwen AI lead scoring
5. Decision gate based on score
6. Proposal generation
7. Human approval via Telegram
8. Email delivery and follow-up
9. Decline or nurture paths
10. Client onboarding
11. Invoice generation and payment
12. Project kickoff notifications

Those later workflow stages are roadmap items, not implemented code in this repo yet.

## Supabase integration

Supabase is the system of record for leads.

### Files

- [`supabase/leads.sql`](./supabase/leads.sql): base table, constraints, indexes, trigger, grants, and RLS policy
- [`supabase/migrations/20260701030000_harden_public_lead_inserts.sql`](./supabase/migrations/20260701030000_harden_public_lead_inserts.sql): follow-up hardening migration
- [`supabase/migrations/20260702090000_add_select_label_value_payload.sql`](./supabase/migrations/20260702090000_add_select_label_value_payload.sql): select label/value payload migration
- [`supabase.js`](./supabase.js): browser client and insert helper

### Table behavior

- Public users can insert only.
- Public users cannot read, update, or delete leads.
- Workflow state fields are guarded for public inserts.
- The migration adds database-side fallbacks for timestamps and lead IDs.
- `n8n_status` is the operational handoff state tracked after the public insert succeeds.

## Qwen AI integration

Qwen integration is planned, not implemented in the current app runtime.

### What is already documented

- The build plan targets Qwen Cloud on Alibaba Cloud.
- `.env` in the local workspace already contains placeholder or early-stage Qwen variables.
- `.env.example` now documents the expected future Qwen configuration keys.

### Planned Qwen responsibilities

- Lead scoring
- Score reasoning
- Proposal generation
- Conversational Telegram intake handling

No frontend code in this repo currently calls Qwen directly.

## Deployment

The app is designed for Netlify.

### Netlify configuration

- [`netlify.toml`](./netlify.toml) sets:
  - publish directory to the repo root
  - functions directory to `netlify/functions`
  - Node version to `22`
  - `esbuild` bundling for functions
  - basic security and cache headers

### Deploy flow

1. Create the Supabase schema with `supabase/leads.sql`.
2. Apply the migrations if your database does not already include them.
3. Set environment variables in Netlify.
4. Deploy the repo to Netlify.
5. Submit a test lead.
6. Confirm the row exists in Supabase.
7. Confirm `notify-n8n` can reach your n8n webhook when configured.

## Environment variables

Use `.env.example` as the template.

### Required for the current shipped app

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
  Or `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Optional for the current shipped app

- `N8N_WEBHOOK_URL`

If `N8N_WEBHOOK_URL` is missing, leads still save to Supabase and the app reports that the automation handoff is pending.

### Optional future-facing variables already documented

- `N8N_BASE_URL`
- `N8N_API_KEY`
- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `QWEN_MODEL`

## Local development

Install dependencies and run the local Netlify environment:

```bash
npm install
npx netlify dev
```

### Schema verification

Run the lead-schema smoke test:

```bash
npm run verify:lead-schema
```

## Roadmap

### Completed in this repo

- Public web intake form
- Shared validation and normalization contract
- Supabase insert flow
- Netlify runtime config function
- Netlify n8n handoff function
- Success-state handling for saved-but-pending leads
- Premium landing-page redesign

### Next likely build steps

1. Wire the actual n8n webhook and confirm end-to-end status updates
2. Finalize the shared n8n normalizer and orchestration entry workflow
3. Implement Qwen lead scoring and score logging
4. Add Telegram owner alerts and approval flow
5. Add proposal generation and outbound communication steps

## Future features

The shared lead schema already reserves fields for future expansion so the data contract does not need to be reinvented later.

### Reserved or planned areas

- File uploads
- AI score and AI summary
- Proposal IDs and proposal workflow
- Invoice IDs and payment status
- Workspace ownership
- User identity and authenticated client views
- Telegram conversational intake
- Client onboarding automation
- Payment collection and kickoff automation

## Notes and assumptions

- The current public site is intentionally client-facing and should avoid exposing internal pipeline stages in the UI.
- `autolancer-lead-form.html` remains as a simple redirect entry.
- `AutoLancer_Build_Plan.pdf` is treated as roadmap input, not as proof that those later systems are already implemented.
- The repo currently contains only one markdown documentation file, so this README consolidates the project documentation rather than replacing multiple docs.
