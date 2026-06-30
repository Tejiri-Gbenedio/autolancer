# AutoLancer Intake Portal

Production-ready project intake for AutoLancer, the autonomous freelance pipeline agent for the Global AI Hackathon Qwen Cloud Track 4.

The form keeps Supabase as the source of truth. Every lead is inserted into `public.leads` first, then the exact same lead payload is sent to n8n through a Netlify Function. If n8n fails, the lead remains saved and `n8n_status` is updated to `failed`.

## Connect Supabase and n8n in under 5 minutes

1. Open Supabase SQL Editor and run [`supabase/leads.sql`](./supabase/leads.sql).
2. In Netlify, add these environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `N8N_WEBHOOK_URL`
3. In n8n, create a Webhook trigger that accepts `POST` JSON and copy its production URL into `N8N_WEBHOOK_URL`.
4. Deploy this repository to Netlify. No build command is required.
5. Submit a test lead and confirm:
   - Supabase has a row in `public.leads`.
   - n8n receives the same payload.
   - `n8n_status` becomes `delivered` or `failed`.

## Files

- `index.html` - accessible intake application markup.
- `styles.css` - premium dark SaaS interface.
- `app.js` - validation, loading stages, duplicate-submit protection, success state.
- `config.js` - shared app configuration and runtime config loading.
- `supabase.js` - browser Supabase REST insert using the anon key.
- `helpers.js` - small reusable utilities.
- `netlify/functions/config.js` - exposes only public Supabase config to the browser.
- `netlify/functions/notify-n8n.js` - posts to n8n and updates `n8n_status`.
- `supabase/leads.sql` - table, constraints, indexes, and RLS insert policy.
- `n8n/lead-normalizer-function.js` - optional n8n Code node normalizer.

## Local development

Install or run the Netlify CLI, then start the app with local environment variables:

```bash
npx netlify dev
```

Use `.env.example` as the template for `.env`. The service role key is used only inside Netlify Functions and is never sent to the browser.

## Lead payload

The browser inserts and forwards this shape:

```json
{
  "lead_id": "lead_20260622093000_demo001",
  "created_at": "2026-06-22T09:30:00.000Z",
  "full_name": "Jane Doe",
  "email": "jane@company.com",
  "project_type": "automation",
  "budget_range": "1000_3000",
  "timeline": "2_weeks",
  "source": "linkedin",
  "description": "Project brief...",
  "existing_tools": "Airtable, Gmail",
  "intake_channel": "web_form",
  "status": "new",
  "n8n_status": "pending"
}
```
