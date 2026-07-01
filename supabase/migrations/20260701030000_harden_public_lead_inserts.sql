-- AutoLancer follow-up migration
-- Purpose:
-- - Add workspace ownership support without creating a workspace table yet.
-- - Prevent public clients from controlling lead workflow state.
-- - Let the database generate timestamps and fallback lead IDs.
-- - Keep the existing public insert policy name so this migration matches the
--   policy already present in Supabase.

alter table public.leads
  add column if not exists workspace_id uuid;

create or replace function public.generate_lead_id()
returns text
language sql
volatile
as $$
  select
    'lead_'
    || to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS')
    || '_'
    || left(replace(gen_random_uuid()::text, '-', ''), 8);
$$;

alter table public.leads
  alter column lead_id set default public.generate_lead_id(),
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column status set default 'new',
  alter column n8n_status set default 'pending';

alter table public.leads
  alter column lead_id set not null,
  alter column created_at set not null,
  alter column updated_at set not null,
  alter column status set not null,
  alter column n8n_status set not null;

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

drop trigger if exists prepare_lead_public_insert on public.leads;

create trigger prepare_lead_public_insert
before insert on public.leads
for each row
execute function public.prepare_lead_public_insert();

alter table public.leads enable row level security;

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
  and intake_channel = 'web_form'
);
