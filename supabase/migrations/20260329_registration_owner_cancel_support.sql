alter table public.event_registrations
  add column if not exists owner_token_hash text;

update public.event_registrations
set owner_token_hash = lower(
  md5(id::text || coalesce(submitted_at::text, ''))
  ||
  md5(coalesce(submitted_at::text, '') || id::text)
)
where owner_token_hash is null
  or btrim(owner_token_hash) = ''
  or btrim(owner_token_hash) !~ '^[A-Fa-f0-9]{64}$';

alter table public.event_registrations
  alter column owner_token_hash set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_registrations_owner_token_hash_format'
      and conrelid = 'public.event_registrations'::regclass
  ) then
    alter table public.event_registrations
      add constraint event_registrations_owner_token_hash_format
      check (owner_token_hash ~ '^[a-f0-9]{64}$');
  end if;
end;
$$;

create or replace function public.registration_owner_token_hash(p_owner_token text)
returns text
language sql
immutable
as $$
  select case
    when btrim(coalesce(p_owner_token, '')) ~ '^[A-Fa-f0-9]{64}$'
      then lower(btrim(p_owner_token))
    else ''
  end;
$$;

drop function if exists public.get_registration_state(text);
drop function if exists public.get_registration_state(text, text);

create or replace function public.get_registration_state(p_event_id text, p_owner_token text)
returns jsonb
language plpgsql
stable
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  owner_token_hash_value text := public.registration_owner_token_hash(p_owner_token);
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
        'submittedAt', submitted_at,
        'canCancel', owner_token_hash_value <> '' and owner_token_hash = owner_token_hash_value
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

create or replace function public.get_registration_state(p_event_id text)
returns jsonb
language sql
stable
as $$
  select public.get_registration_state(p_event_id, null);
$$;

drop function if exists public.submit_event_registration(text, text, text, text, text[]);
drop function if exists public.submit_event_registration(text, text, text, text, text[], text);

create or replace function public.submit_event_registration(
  p_event_id text,
  p_family text,
  p_name text default null,
  p_captain text default null,
  p_members text[] default null,
  p_owner_token text default null
)
returns jsonb
language plpgsql
volatile
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  normalized_family text := btrim(coalesce(p_family, ''));
  owner_token_hash_value text := public.registration_owner_token_hash(p_owner_token);
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

  if owner_token_hash_value = '' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_owner_token',
      'message', 'Invalid registration owner token.'
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
      'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
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
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
      );
    end if;

    normalized_name := public.normalize_person_name(p_name);
    if normalized_name = '' then
      return jsonb_build_object(
        'status', 400,
        'error', 'invalid_payload',
        'message', 'Please enter the participant name.',
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
      );
    end if;

    insert into public.event_registrations (
      event_id,
      event_title,
      registration_type,
      family,
      name,
      owner_token_hash,
      submitted_at
    )
    values (
      normalized_event,
      event_title,
      'individual',
      normalized_family,
      normalized_name,
      owner_token_hash_value,
      timezone('utc', now())
    )
    returning * into inserted;
  else
    if family_count >= 2 then
      return jsonb_build_object(
        'status', 409,
        'error', 'family_team_limit_reached',
        'message', 'This family has already registered the maximum number of teams.',
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
      );
    end if;

    normalized_captain := public.normalize_person_name(p_captain);
    if normalized_captain = '' then
      return jsonb_build_object(
        'status', 400,
        'error', 'invalid_payload',
        'message', 'Please enter the team captain.',
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
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
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
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
      owner_token_hash,
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
      owner_token_hash_value,
      timezone('utc', now())
    )
    returning * into inserted;
  end if;

  state_payload := public.get_registration_state(normalized_event, p_owner_token) - 'status';

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
      'submittedAt', inserted.submitted_at,
      'canCancel', true
    ),
    'state', state_payload,
    'message', 'You are successfully registered.'
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
language sql
volatile
as $$
  select public.submit_event_registration(p_event_id, p_family, p_name, p_captain, p_members, null);
$$;

create or replace function public.cancel_event_registration(
  p_registration_id text,
  p_event_id text,
  p_owner_token text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  normalized_event text := lower(btrim(coalesce(p_event_id, '')));
  normalized_registration_id text := btrim(coalesce(p_registration_id, ''));
  owner_token_hash_value text := public.registration_owner_token_hash(p_owner_token);
  deleted_registration_id uuid;
  exists_same_registration boolean := false;
  state_payload jsonb;
begin
  if normalized_event not in ('rubiks-cube-competition', 'sudoku-game-easy-level', 'codm-tournament') then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported registration event.'
    );
  end if;

  if normalized_registration_id = '' or normalized_registration_id !~ '^[a-f0-9-]{36}$' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_registration_id',
      'message', 'Invalid registration id.'
    );
  end if;

  if owner_token_hash_value = '' then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_owner_token',
      'message', 'Invalid registration owner token.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('registration:' || normalized_event));

  delete from public.event_registrations
  where id = normalized_registration_id::uuid
    and event_id = normalized_event
    and owner_token_hash = owner_token_hash_value
  returning id into deleted_registration_id;

  if deleted_registration_id is null then
    select exists (
      select 1
      from public.event_registrations
      where id = normalized_registration_id::uuid
        and event_id = normalized_event
    )
    into exists_same_registration;

    if exists_same_registration then
      return jsonb_build_object(
        'status', 403,
        'error', 'forbidden',
        'message', 'You can cancel only your own registration.',
        'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
      );
    end if;

    return jsonb_build_object(
      'status', 404,
      'error', 'registration_not_found',
      'message', 'Registration not found.',
      'state', public.get_registration_state(normalized_event, p_owner_token) - 'status'
    );
  end if;

  state_payload := public.get_registration_state(normalized_event, p_owner_token) - 'status';

  return jsonb_build_object(
    'status', 200,
    'registrationId', normalized_registration_id,
    'state', state_payload,
    'message', 'Your registration has been canceled.'
  );
end;
$$;

revoke all on function public.get_registration_state(text) from public;
revoke all on function public.get_registration_state(text, text) from public;
revoke all on function public.submit_event_registration(text, text, text, text, text[]) from public;
revoke all on function public.submit_event_registration(text, text, text, text, text[], text) from public;
revoke all on function public.cancel_event_registration(text, text, text) from public;

grant execute on function public.get_registration_state(text) to anon, authenticated;
grant execute on function public.get_registration_state(text, text) to anon, authenticated;
grant execute on function public.submit_event_registration(text, text, text, text, text[]) to anon, authenticated;
grant execute on function public.submit_event_registration(text, text, text, text, text[], text) to anon, authenticated;
grant execute on function public.cancel_event_registration(text, text, text) to anon, authenticated;
