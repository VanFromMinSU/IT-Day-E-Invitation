create table if not exists public.event_mechanics (
  event_id text primary key,
  venue text not null default '',
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint event_mechanics_event_id_check check (event_id ~ '^[a-z0-9-]{3,80}$'),
  constraint event_mechanics_venue_length_check check (char_length(venue) <= 160),
  constraint event_mechanics_sections_array_check check (jsonb_typeof(sections) = 'array')
);

alter table public.event_mechanics
  add column if not exists venue text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_mechanics_venue_length_check'
      and conrelid = 'public.event_mechanics'::regclass
  ) then
    alter table public.event_mechanics
      add constraint event_mechanics_venue_length_check check (char_length(venue) <= 160);
  end if;
end;
$$;

alter table public.event_mechanics enable row level security;

drop policy if exists event_mechanics_select_public on public.event_mechanics;
create policy event_mechanics_select_public
  on public.event_mechanics
  for select
  to anon, authenticated
  using (true);

create or replace function public.get_event_mechanics(p_event_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  entry record;
begin
  if normalized_event = '' or normalized_event !~ '^[a-z0-9-]{3,80}$' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported event.'
    );
  end if;

  select event_id, venue, sections, updated_at
  into entry
  from public.event_mechanics
  where event_id = normalized_event;

  if not found then
    return jsonb_build_object(
      'status', 404,
      'error', 'not_found',
      'message', 'No custom mechanics found for this event.'
    );
  end if;

  return jsonb_build_object(
    'status', 200,
    'eventId', entry.event_id,
    'venue', coalesce(entry.venue, ''),
    'sections', entry.sections,
    'updatedAt', entry.updated_at
  );
end;
$$;

create or replace function public.upsert_event_mechanics_with_token(
  p_event_id text,
  p_venue text,
  p_sections jsonb,
  p_admin_token_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  configured_admin_token_hash text := lower(
    coalesce(
      nullif(current_setting('app.response_admin_token_hash', true), ''),
      'fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4'
    )
  );
  provided_admin_token_hash text := lower(btrim(coalesce(p_admin_token_hash, '')));
  normalized_venue text := left(regexp_replace(coalesce(p_venue, ''), '\\s+', ' ', 'g'), 160);
  normalized_sections jsonb := coalesce(p_sections, '[]'::jsonb);
  mutation_time timestamptz := timezone('utc', now());
  has_existing_record boolean := false;
  operation text := 'create';
begin
  if provided_admin_token_hash = '' or provided_admin_token_hash <> configured_admin_token_hash then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  if normalized_event = '' or normalized_event !~ '^[a-z0-9-]{3,80}$' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported event.'
    );
  end if;

  if jsonb_typeof(normalized_sections) <> 'array' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_payload',
      'message', 'Please provide valid mechanics sections.'
    );
  end if;

  if jsonb_array_length(normalized_sections) = 0 and normalized_venue = '' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_payload',
      'message', 'Please provide at least one section or a venue.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('event_mechanics:' || normalized_event));

  select exists(
    select 1
    from public.event_mechanics
    where event_id = normalized_event
  )
  into has_existing_record;

  if has_existing_record then
    operation := 'update';
    update public.event_mechanics
    set venue = normalized_venue,
        sections = normalized_sections,
        updated_at = mutation_time
    where event_id = normalized_event;
  else
    operation := 'create';
    insert into public.event_mechanics (event_id, venue, sections, updated_at)
    values (normalized_event, normalized_venue, normalized_sections, mutation_time);
  end if;

  raise notice '[event_mechanics] event_id=%, operation=%, sections=%, venue=%',
    normalized_event,
    operation,
    jsonb_array_length(normalized_sections),
    normalized_venue;

  return jsonb_build_object(
    'status', 200,
    'eventId', normalized_event,
    'operation', operation,
    'created', operation = 'create',
    'venue', normalized_venue,
    'sections', normalized_sections,
    'updatedAt', mutation_time,
    'message', case when operation = 'create' then 'Mechanics created successfully.' else 'Mechanics updated successfully.' end
  );
end;
$$;

create or replace function public.delete_event_mechanics_with_token(
  p_event_id text,
  p_admin_token_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  configured_admin_token_hash text := lower(
    coalesce(
      nullif(current_setting('app.response_admin_token_hash', true), ''),
      'fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4'
    )
  );
  provided_admin_token_hash text := lower(btrim(coalesce(p_admin_token_hash, '')));
begin
  if provided_admin_token_hash = '' or provided_admin_token_hash <> configured_admin_token_hash then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  if normalized_event = '' or normalized_event !~ '^[a-z0-9-]{3,80}$' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported event.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('event_mechanics:' || normalized_event));
  delete from public.event_mechanics where event_id = normalized_event;

  return jsonb_build_object(
    'status', 200,
    'eventId', normalized_event,
    'message', 'Mechanics deleted successfully.'
  );
end;
$$;

revoke all on function public.get_event_mechanics(text) from public;
revoke all on function public.upsert_event_mechanics_with_token(text, text, jsonb, text) from public;
revoke all on function public.delete_event_mechanics_with_token(text, text) from public;
revoke all on function public.upsert_event_mechanics_with_token(text, jsonb, text) from public;

grant execute on function public.get_event_mechanics(text) to anon, authenticated;
grant execute on function public.upsert_event_mechanics_with_token(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.delete_event_mechanics_with_token(text, text) to anon, authenticated;
