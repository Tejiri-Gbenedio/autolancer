-- AutoLancer select label/value migration
-- Purpose:
-- - Store human-readable select labels in the existing display columns.
-- - Store machine-friendly values in new *_value columns for automation.
-- - Keep intake_channel hidden in the UI while preserving both label and value.

alter table public.leads
  add column if not exists project_type_value text,
  add column if not exists budget_range_value text,
  add column if not exists timeline_value text,
  add column if not exists source_value text,
  add column if not exists intake_channel_value text;

update public.leads
set
  project_type_value = coalesce(
    project_type_value,
    case project_type
      when 'Automation / workflow' then 'automation'
      when 'Website / web app' then 'web_development'
      when 'Chatbot / AI assistant' then 'chatbot'
      when 'API / integration' then 'integration'
      when 'Other' then 'other'
      else project_type
    end
  ),
  budget_range_value = coalesce(
    budget_range_value,
    case budget_range
      when 'Under $500' then 'under_500'
      when '$500 - $1,000' then '500_1000'
      when '$1,000 - $3,000' then '1000_3000'
      when '$3,000+' then '3000_plus'
      else budget_range
    end
  ),
  timeline_value = coalesce(
    timeline_value,
    case timeline
      when 'Within 1 week' then '1_week'
      when 'Within 2 weeks' then '2_weeks'
      when 'Within 1 month' then '1_month'
      when 'Flexible / no rush' then 'flexible'
      else timeline
    end
  ),
  source_value = coalesce(
    source_value,
    case source
      when 'LinkedIn' then 'linkedin'
      when 'Referral' then 'referral'
      when 'Twitter / X' then 'twitter'
      when 'Google search' then 'google'
      when 'Other' then 'other'
      when 'unknown' then null
      else source
    end
  ),
  intake_channel_value = coalesce(
    intake_channel_value,
    case intake_channel
      when 'Web Form' then 'web_form'
      else intake_channel
    end,
    'web_form'
  );

alter table public.leads
  drop constraint if exists leads_project_type_check,
  drop constraint if exists leads_project_type_value_check,
  drop constraint if exists leads_budget_range_check,
  drop constraint if exists leads_budget_range_value_check,
  drop constraint if exists leads_timeline_check,
  drop constraint if exists leads_timeline_value_check,
  drop constraint if exists leads_source_check,
  drop constraint if exists leads_source_value_check,
  drop constraint if exists leads_intake_channel_check,
  drop constraint if exists leads_intake_channel_value_check,
  drop constraint if exists leads_project_type_pair_check,
  drop constraint if exists leads_budget_range_pair_check,
  drop constraint if exists leads_timeline_pair_check,
  drop constraint if exists leads_source_pair_check;

alter table public.leads
  alter column source drop default,
  alter column source drop not null;

update public.leads
set
  project_type = case project_type_value
    when 'automation' then 'Automation / workflow'
    when 'web_development' then 'Website / web app'
    when 'chatbot' then 'Chatbot / AI assistant'
    when 'integration' then 'API / integration'
    when 'other' then 'Other'
    else project_type
  end,
  budget_range = case budget_range_value
    when 'under_500' then 'Under $500'
    when '500_1000' then '$500 - $1,000'
    when '1000_3000' then '$1,000 - $3,000'
    when '3000_plus' then '$3,000+'
    else budget_range
  end,
  timeline = case timeline_value
    when '1_week' then 'Within 1 week'
    when '2_weeks' then 'Within 2 weeks'
    when '1_month' then 'Within 1 month'
    when 'flexible' then 'Flexible / no rush'
    else timeline
  end,
  source = case source_value
    when 'linkedin' then 'LinkedIn'
    when 'referral' then 'Referral'
    when 'twitter' then 'Twitter / X'
    when 'google' then 'Google search'
    when 'other' then 'Other'
    else null
  end,
  intake_channel = 'Web Form';

alter table public.leads
  alter column project_type_value set not null,
  alter column budget_range_value set not null,
  alter column timeline_value set not null,
  alter column intake_channel set default 'Web Form',
  alter column intake_channel_value set default 'web_form',
  alter column intake_channel_value set not null;

alter table public.leads
  add constraint leads_project_type_check check (project_type in (
    'Automation / workflow',
    'Website / web app',
    'Chatbot / AI assistant',
    'API / integration',
    'Other'
  )),
  add constraint leads_project_type_value_check check (project_type_value in (
    'automation',
    'web_development',
    'chatbot',
    'integration',
    'other'
  )),
  add constraint leads_budget_range_check check (budget_range in (
    'Under $500',
    '$500 - $1,000',
    '$1,000 - $3,000',
    '$3,000+'
  )),
  add constraint leads_budget_range_value_check check (budget_range_value in (
    'under_500',
    '500_1000',
    '1000_3000',
    '3000_plus'
  )),
  add constraint leads_timeline_check check (timeline in (
    'Within 1 week',
    'Within 2 weeks',
    'Within 1 month',
    'Flexible / no rush'
  )),
  add constraint leads_timeline_value_check check (timeline_value in (
    '1_week',
    '2_weeks',
    '1_month',
    'flexible'
  )),
  add constraint leads_source_check check (source is null or source in (
    'LinkedIn',
    'Referral',
    'Twitter / X',
    'Google search',
    'Other'
  )),
  add constraint leads_source_value_check check (source_value is null or source_value in (
    'linkedin',
    'referral',
    'twitter',
    'google',
    'other'
  )),
  add constraint leads_intake_channel_check check (intake_channel = 'Web Form'),
  add constraint leads_intake_channel_value_check check (intake_channel_value = 'web_form'),
  add constraint leads_project_type_pair_check check (
    (project_type = 'Automation / workflow' and project_type_value = 'automation')
    or (project_type = 'Website / web app' and project_type_value = 'web_development')
    or (project_type = 'Chatbot / AI assistant' and project_type_value = 'chatbot')
    or (project_type = 'API / integration' and project_type_value = 'integration')
    or (project_type = 'Other' and project_type_value = 'other')
  ),
  add constraint leads_budget_range_pair_check check (
    (budget_range = 'Under $500' and budget_range_value = 'under_500')
    or (budget_range = '$500 - $1,000' and budget_range_value = '500_1000')
    or (budget_range = '$1,000 - $3,000' and budget_range_value = '1000_3000')
    or (budget_range = '$3,000+' and budget_range_value = '3000_plus')
  ),
  add constraint leads_timeline_pair_check check (
    (timeline = 'Within 1 week' and timeline_value = '1_week')
    or (timeline = 'Within 2 weeks' and timeline_value = '2_weeks')
    or (timeline = 'Within 1 month' and timeline_value = '1_month')
    or (timeline = 'Flexible / no rush' and timeline_value = 'flexible')
  ),
  add constraint leads_source_pair_check check (
    (source is null and source_value is null)
    or (source = 'LinkedIn' and source_value = 'linkedin')
    or (source = 'Referral' and source_value = 'referral')
    or (source = 'Twitter / X' and source_value = 'twitter')
    or (source = 'Google search' and source_value = 'google')
    or (source = 'Other' and source_value = 'other')
  );

create index if not exists leads_project_type_value_idx on public.leads (project_type_value);

create or replace function public.prepare_lead_public_insert()
returns trigger
language plpgsql
as $$
declare
  generated_at timestamptz := now();
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), current_user);
begin
  -- Public clients may submit these fields, but they do not get to control
  -- the workflow state or timestamps. This keeps Supabase as the source of
  -- truth while preserving compatibility with the current frontend payload.
  if request_role = 'anon' or current_user = 'anon' then
    new.created_at := generated_at;
    new.updated_at := generated_at;
    new.status := 'new';
    new.n8n_status := 'pending';
    new.workspace_id := null;
    new.n8n_last_error := null;
    new.n8n_delivered_at := null;
  end if;

  -- All roles get a safe server-side fallback when lead_id is omitted.
  if new.lead_id is null or btrim(new.lead_id) = '' then
    new.lead_id := public.generate_lead_id();
  end if;

  return new;
end;
$$;

revoke insert on table public.leads from anon;
grant insert (
  lead_id,
  created_at,
  updated_at,
  full_name,
  email,
  phone,
  project_type,
  project_type_value,
  budget_range,
  budget_range_value,
  timeline,
  timeline_value,
  source,
  source_value,
  description,
  existing_tools,
  website_url,
  intake_channel,
  intake_channel_value,
  status,
  n8n_status
) on table public.leads to anon;

drop policy if exists "Public can submit lead intake records" on public.leads;

create policy "Public can submit lead intake records"
on public.leads
for insert
to anon
with check (
  workspace_id is null
  and status = 'new'
  and n8n_status = 'pending'
  and created_at = now()
  and updated_at = created_at
  and n8n_last_error is null
  and n8n_delivered_at is null
  and intake_channel = 'Web Form'
  and intake_channel_value = 'web_form'
);
