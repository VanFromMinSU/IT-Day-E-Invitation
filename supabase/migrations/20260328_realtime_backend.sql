create extension if not exists pgcrypto;

create table if not exists public.reaction_meta (
  id boolean primary key default true,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.reaction_meta (id, updated_at)
values (true, timezone('utc', now()))
on conflict (id) do nothing;

create table if not exists public.event_votes (
  voter_id text primary key check (voter_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  response_type text not null check (response_type in ('interested', 'excited')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (event_id in ('rubiks-cube-competition', 'sudoku-game-easy-level', 'codm-tournament')),
  event_title text not null,
  registration_type text not null check (registration_type in ('individual', 'team')),
  family text not null check (family in ('Family 1 - Claude', 'Family 2 - Grok', 'Family 3 - Gemini', 'Family 4 - Dola')),
  name text,
  captain text,
  members text[],
  team_label text,
  team_size integer,
  submitted_at timestamptz not null default timezone('utc', now()),
  check (
    (
      registration_type = 'individual'
      and name is not null
      and captain is null
      and members is null
      and team_label is null
      and team_size is null
    )
    or
    (
      registration_type = 'team'
      and name is null
      and captain is not null
      and members is not null
      and array_length(members, 1) = 3
      and team_label is not null
      and team_size = 4
    )
  )
);

create index if not exists idx_event_registrations_event_id
  on public.event_registrations (event_id);

create index if not exists idx_event_registrations_event_family
  on public.event_registrations (event_id, family);

alter table public.event_votes enable row level security;
alter table public.event_registrations enable row level security;

alter table public.event_votes replica identity full;
alter table public.event_registrations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_votes'
      and policyname = 'votes_select_public'
  ) then
    create policy votes_select_public
      on public.event_votes
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_votes'
      and policyname = 'votes_insert_public'
  ) then
    create policy votes_insert_public
      on public.event_votes
      for insert
      to anon, authenticated
      with check (response_type in ('interested', 'excited'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_registrations'
      and policyname = 'registrations_select_public'
  ) then
    create policy registrations_select_public
      on public.event_registrations
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_registrations'
      and policyname = 'registrations_insert_public'
  ) then
    create policy registrations_insert_public
      on public.event_registrations
      for insert
      to anon, authenticated
      with check (
        event_id in ('rubiks-cube-competition', 'sudoku-game-easy-level', 'codm-tournament')
      );
  end if;
end;
$$;

create or replace function public.normalize_person_name(value text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text;
begin
  normalized := regexp_replace(coalesce(value, ''), '\s+', ' ', 'g');
  normalized := btrim(normalized);

  if normalized = '' then
    return '';
  end if;

  return left(normalized, 80);
end;
$$;

create or replace function public.registration_event_title(p_event_id text)
returns text
language sql
immutable
as $$
  select case p_event_id
    when 'rubiks-cube-competition' then 'Rubik''s Cube Competition'
    when 'sudoku-game-easy-level' then 'Sudoku Game (Easy Level)'
    when 'codm-tournament' then 'Call of Duty: Mobile (CODM) Tournament'
    else p_event_id
  end;
$$;

create or replace function public.registration_family_prefix(p_family text)
returns text
language sql
immutable
as $$
  select case p_family
    when 'Family 1 - Claude' then 'A'
    when 'Family 2 - Grok' then 'B'
    when 'Family 3 - Gemini' then 'C'
    when 'Family 4 - Dola' then 'D'
    else 'X'
  end;
$$;

create or replace function public.get_reaction_state()
returns jsonb
language sql
stable
as $$
  with vote_counts as (
    select
      count(*) filter (where response_type = 'interested')::int as interested,
      count(*) filter (where response_type = 'excited')::int as excited
    from public.event_votes
  ), meta as (
    select coalesce(max(updated_at), timezone('utc', now())) as updated_at
    from public.reaction_meta
  )
  select jsonb_build_object(
    'status', 200,
    'counts', jsonb_build_object(
      'interested', vote_counts.interested,
      'excited', vote_counts.excited
    ),
    'total', vote_counts.interested + vote_counts.excited,
    'updatedAt', meta.updated_at,
    'reason', 'snapshot'
  )
  from vote_counts, meta;
$$;

create or replace function public.get_vote_status(p_voter_id text)
returns jsonb
language plpgsql
stable
as $$
declare
  normalized_voter text := btrim(coalesce(p_voter_id, ''));
  existing_vote text;
  meta_updated_at timestamptz;
begin
  select coalesce(max(updated_at), timezone('utc', now()))
  into meta_updated_at
  from public.reaction_meta;

  if normalized_voter = '' or normalized_voter !~ '^[A-Za-z0-9_-]{8,128}$' then
    return jsonb_build_object(
      'status', 200,
      'hasVoted', false,
      'responseType', '',
      'updatedAt', meta_updated_at
    );
  end if;

  select response_type
  into existing_vote
  from public.event_votes
  where voter_id = normalized_voter;

  return jsonb_build_object(
    'status', 200,
    'hasVoted', existing_vote is not null,
    'responseType', coalesce(existing_vote, ''),
    'updatedAt', meta_updated_at
  );
end;
$$;

create or replace function public.submit_vote(p_voter_id text, p_response_type text)
returns jsonb
language plpgsql
volatile
as $$
declare
  normalized_voter text := btrim(coalesce(p_voter_id, ''));
  normalized_response text := lower(btrim(coalesce(p_response_type, '')));
  existing_vote text;
  mutation_time timestamptz := timezone('utc', now());
begin
  if normalized_response not in ('interested', 'excited')
     or normalized_voter = ''
     or normalized_voter !~ '^[A-Za-z0-9_-]{8,128}$' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_payload',
      'message', 'Invalid response type or voter id.'
    );
  end if;

  insert into public.event_votes (voter_id, response_type, created_at)
  values (normalized_voter, normalized_response, mutation_time)
  on conflict (voter_id) do nothing;

  if not found then
    select response_type
    into existing_vote
    from public.event_votes
    where voter_id = normalized_voter;

    return (public.get_reaction_state() - 'status' - 'reason') || jsonb_build_object(
      'status', 409,
      'error', 'already_voted',
      'responseType', coalesce(existing_vote, '')
    );
  end if;

  insert into public.reaction_meta (id, updated_at)
  values (true, mutation_time)
  on conflict (id) do update
    set updated_at = excluded.updated_at;

  return (public.get_reaction_state() - 'status') || jsonb_build_object(
    'status', 201,
    'responseType', normalized_response,
    'reason', 'vote'
  );
end;
$$;

create or replace function public.get_registration_state(p_event_id text)
returns jsonb
language plpgsql
stable
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  event_title_value text;
  total_count integer := 0;
  per_family jsonb := '[]'::jsonb;
  registrations jsonb := '[]'::jsonb;
  teams jsonb := '[]'::jsonb;
  stats jsonb;
  updated_at timestamptz := timezone('utc', now());
  all_families_complete boolean := false;
begin
  if normalized_event not in ('rubiks-cube-competition', 'sudoku-game-easy-level', 'codm-tournament') then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported registration event.'
    );
  end if;

  event_title_value := public.registration_event_title(normalized_event);

  select count(*)::int, coalesce(max(submitted_at), timezone('utc', now()))
  into total_count, updated_at
  from public.event_registrations
  where event_id = normalized_event;

  with families(family, ordinal) as (
    values
      ('Family 1 - Claude'::text, 1),
      ('Family 2 - Grok'::text, 2),
      ('Family 3 - Gemini'::text, 3),
      ('Family 4 - Dola'::text, 4)
  ), counts as (
    select family, count(*)::int as count
    from public.event_registrations
    where event_id = normalized_event
    group by family
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'family', families.family,
        'count', coalesce(counts.count, 0),
        'limit', 2,
        'remaining', greatest(0, 2 - coalesce(counts.count, 0))
      )
      order by families.ordinal
    ),
    '[]'::jsonb
  )
  into per_family
  from families
  left join counts on counts.family = families.family;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'eventId', event_id,
        'eventTitle', public.event_registrations.event_title,
        'registrationType', registration_type,
        'family', family,
        'name', name,
        'captain', captain,
        'members', members,
        'teamLabel', team_label,
        'teamSize', team_size,
        'submittedAt', submitted_at
      )
      order by submitted_at
    ),
    '[]'::jsonb
  )
  into registrations
  from public.event_registrations
  where event_id = normalized_event;

  if normalized_event in ('rubiks-cube-competition', 'sudoku-game-easy-level') then
    with families(family) as (
      values
        ('Family 1 - Claude'::text),
        ('Family 2 - Grok'::text),
        ('Family 3 - Gemini'::text),
        ('Family 4 - Dola'::text)
    ), counts as (
      select family, count(*)::int as count
      from public.event_registrations
      where event_id = normalized_event
      group by family
    )
    select bool_and(coalesce(counts.count, 0) = 2)
    into all_families_complete
    from families
    left join counts on counts.family = families.family;

    stats := jsonb_build_object(
      'mode', 'individual',
      'totalParticipants', total_count,
      'maxParticipants', 8,
      'remainingParticipants', greatest(0, 8 - total_count),
      'isClosed', total_count >= 8,
      'perFamily', per_family,
      'allFamiliesComplete', case when normalized_event = 'sudoku-game-easy-level' then all_families_complete else null end
    );
  else
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id::text,
          'family', family,
          'teamLabel', team_label,
          'teamSize', team_size,
          'submittedAt', submitted_at
        )
        order by submitted_at
      ),
      '[]'::jsonb
    )
    into teams
    from public.event_registrations
    where event_id = normalized_event;

    stats := jsonb_build_object(
      'mode', 'team',
      'totalTeams', total_count,
      'maxTeams', 8,
      'remainingTeams', greatest(0, 8 - total_count),
      'isClosed', total_count >= 8,
      'perFamily', per_family,
      'teams', teams
    );
  end if;

  return jsonb_build_object(
    'status', 200,
    'eventId', normalized_event,
    'eventTitle', event_title_value,
    'registrations', registrations,
    'stats', stats,
    'updatedAt', updated_at,
    'reason', 'snapshot'
  );
end;
$$;

create or replace function public.submit_event_registration(
  p_event_id text,
  p_family text,
  p_name text default null,
  p_captain text default null,
  p_members text[] default null
)
returns jsonb
language plpgsql
volatile
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  normalized_family text := btrim(coalesce(p_family, ''));
  normalized_name text;
  normalized_captain text;
  normalized_members text[];
  total_count integer := 0;
  family_count integer := 0;
  team_number integer := 0;
  team_label text;
  event_title text;
  inserted public.event_registrations%rowtype;
  state_payload jsonb;
begin
  if normalized_event not in ('rubiks-cube-competition', 'sudoku-game-easy-level', 'codm-tournament') then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported registration event.'
    );
  end if;

  if normalized_family not in ('Family 1 - Claude', 'Family 2 - Grok', 'Family 3 - Gemini', 'Family 4 - Dola') then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_payload',
      'message', 'Invalid family selection.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('registration:' || normalized_event));

  event_title := public.registration_event_title(normalized_event);

  select count(*)::int
  into total_count
  from public.event_registrations
  where event_id = normalized_event;

  select count(*)::int
  into family_count
  from public.event_registrations
  where event_id = normalized_event
    and family = normalized_family;

  if total_count >= 8 then
    return jsonb_build_object(
      'status', 409,
      'error', 'registration_closed',
      'message', case
        when normalized_event = 'codm-tournament' then 'Registration is now closed. Maximum teams reached.'
        else 'Registration is now closed. Maximum participants reached.'
      end,
      'state', public.get_registration_state(normalized_event) - 'status'
    );
  end if;

  if normalized_event in ('rubiks-cube-competition', 'sudoku-game-easy-level') then
    if family_count >= 2 then
      return jsonb_build_object(
        'status', 409,
        'error', 'family_limit_reached',
        'message', case
          when normalized_event = 'sudoku-game-easy-level' then 'This family already has 2 participants registered.'
          else 'This family has reached the maximum number of participants.'
        end,
        'state', public.get_registration_state(normalized_event) - 'status'
      );
    end if;

    normalized_name := public.normalize_person_name(p_name);
    if normalized_name = '' then
      return jsonb_build_object(
        'status', 400,
        'error', 'invalid_payload',
        'message', 'Please enter the participant name.',
        'state', public.get_registration_state(normalized_event) - 'status'
      );
    end if;

    insert into public.event_registrations (
      event_id,
      event_title,
      registration_type,
      family,
      name,
      submitted_at
    )
    values (
      normalized_event,
      event_title,
      'individual',
      normalized_family,
      normalized_name,
      timezone('utc', now())
    )
    returning * into inserted;
  else
    if family_count >= 2 then
      return jsonb_build_object(
        'status', 409,
        'error', 'family_team_limit_reached',
        'message', 'This family has already registered the maximum number of teams.',
        'state', public.get_registration_state(normalized_event) - 'status'
      );
    end if;

    normalized_captain := public.normalize_person_name(p_captain);
    if normalized_captain = '' then
      return jsonb_build_object(
        'status', 400,
        'error', 'invalid_payload',
        'message', 'Please enter the team captain.',
        'state', public.get_registration_state(normalized_event) - 'status'
      );
    end if;

    select coalesce(
      array_agg(member_name),
      '{}'::text[]
    )
    into normalized_members
    from (
      select public.normalize_person_name(member) as member_name
      from unnest(coalesce(p_members, '{}'::text[])) as member
    ) normalized
    where normalized.member_name <> '';

    if array_length(normalized_members, 1) is distinct from 3 then
      return jsonb_build_object(
        'status', 400,
        'error', 'invalid_team_size',
        'message', 'Each team must have exactly 4 members including the Team Captain/Leader.',
        'state', public.get_registration_state(normalized_event) - 'status'
      );
    end if;

    team_number := family_count + 1;
    team_label := 'Team ' || public.registration_family_prefix(normalized_family) || team_number::text;

    insert into public.event_registrations (
      event_id,
      event_title,
      registration_type,
      family,
      captain,
      members,
      team_label,
      team_size,
      submitted_at
    )
    values (
      normalized_event,
      event_title,
      'team',
      normalized_family,
      normalized_captain,
      normalized_members,
      team_label,
      4,
      timezone('utc', now())
    )
    returning * into inserted;
  end if;

  state_payload := public.get_registration_state(normalized_event) - 'status';

  return jsonb_build_object(
    'status', 201,
    'registration', jsonb_build_object(
      'id', inserted.id::text,
      'eventId', inserted.event_id,
      'eventTitle', inserted.event_title,
      'registrationType', inserted.registration_type,
      'family', inserted.family,
      'name', inserted.name,
      'captain', inserted.captain,
      'members', inserted.members,
      'teamLabel', inserted.team_label,
      'teamSize', inserted.team_size,
      'submittedAt', inserted.submitted_at
    ),
    'state', state_payload,
    'message', 'Registration submitted successfully.'
  );
end;
$$;

create or replace function public.reset_reactions()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  admin_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  mutation_time timestamptz := timezone('utc', now());
begin
  if admin_role <> 'admin' then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  delete from public.event_votes;

  insert into public.reaction_meta (id, updated_at)
  values (true, mutation_time)
  on conflict (id) do update
    set updated_at = excluded.updated_at;

  return (public.get_reaction_state() - 'status') || jsonb_build_object(
    'status', 200,
    'reason', 'reset'
  );
end;
$$;

revoke all on function public.reset_reactions() from public;

grant execute on function public.get_reaction_state() to anon, authenticated;
grant execute on function public.get_vote_status(text) to anon, authenticated;
grant execute on function public.submit_vote(text, text) to anon, authenticated;
grant execute on function public.get_registration_state(text) to anon, authenticated;
grant execute on function public.submit_event_registration(text, text, text, text, text[]) to anon, authenticated;
grant execute on function public.reset_reactions() to authenticated;
