create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  project_type text not null,
  budget_range text not null,
  timeline text not null,
  source text not null default 'unknown',
  description text not null,
  existing_tools text,
  intake_channel text not null default 'web_form',
  status text not null default 'new',
  n8n_status text not null default 'pending',
  n8n_last_error text,
  n8n_delivered_at timestamptz,
  constraint leads_email_format check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  constraint leads_project_type_check check (project_type in ('automation', 'web_development', 'chatbot', 'integration', 'other')),
  constraint leads_budget_range_check check (budget_range in ('under_500', '500_1000', '1000_3000', '3000_plus')),
  constraint leads_timeline_check check (timeline in ('1_week', '2_weeks', '1_month', 'flexible')),
  constraint leads_source_check check (source in ('linkedin', 'referral', 'twitter', 'google', 'other', 'unknown')),
  constraint leads_intake_channel_check check (intake_channel in ('web_form')),
  constraint leads_status_check check (status in ('new', 'qualified', 'proposal_pending', 'proposal_sent', 'accepted', 'invoiced', 'paid', 'archived')),
  constraint leads_n8n_status_check check (n8n_status in ('pending', 'delivered', 'failed')),
  constraint leads_full_name_length check (char_length(trim(full_name)) between 2 and 160),
  constraint leads_description_length check (char_length(trim(description)) between 20 and 5000)
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_n8n_status_idx on public.leads (n8n_status);

alter table public.leads enable row level security;

revoke all on table public.leads from anon, authenticated;

grant insert (
  lead_id,
  created_at,
  full_name,
  email,
  project_type,
  budget_range,
  timeline,
  source,
  description,
  existing_tools,
  intake_channel,
  status,
  n8n_status
) on table public.leads to anon;

drop policy if exists "Public can submit lead intake records" on public.leads;

create policy "Public can submit lead intake records"
on public.leads
for insert
to anon
with check (
  intake_channel = 'web_form'
  and status = 'new'
  and n8n_status = 'pending'
  and project_type in ('automation', 'web_development', 'chatbot', 'integration', 'other')
  and budget_range in ('under_500', '500_1000', '1000_3000', '3000_plus')
  and timeline in ('1_week', '2_weeks', '1_month', 'flexible')
  and source in ('linkedin', 'referral', 'twitter', 'google', 'other', 'unknown')
);

comment on table public.leads is 'AutoLancer project intake leads. Public clients can insert only; reads and status updates stay server-side.';
