alter table public.event_registrations
  drop constraint if exists event_registrations_event_id_check;

alter table public.event_registrations
  drop constraint if exists event_registrations_registration_shape_check;

alter table public.event_registrations
  add constraint event_registrations_event_id_check
  check (event_id in (
    'rubiks-cube-competition',
    'sudoku-game-easy-level',
    'codm-tournament',
    'mobile-legends-tournament',
    'fast-typing',
    'crimping-competition',
    'assembling-and-disassembling-competition',
    'battle-of-the-bands',
    'basketball-half-court'
  ));

alter table public.event_registrations
  add constraint event_registrations_registration_shape_check
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
      and team_label is not null
      and (
        (
          event_id = 'codm-tournament'
          and array_length(members, 1) = 3
          and team_size = 4
        )
        or
        (
          event_id = 'mobile-legends-tournament'
          and array_length(members, 1) = 4
          and team_size = 5
        )
        or
        (
          event_id = 'battle-of-the-bands'
          and array_length(members, 1) between 4 and 6
          and team_size between 5 and 7
          and team_size = array_length(members, 1) + 1
        )
        or
        (
          event_id = 'basketball-half-court'
          and array_length(members, 1) between 2 and 3
          and team_size between 3 and 4
          and team_size = array_length(members, 1) + 1
        )
      )
    )
  );

drop policy if exists registrations_insert_public on public.event_registrations;

create policy registrations_insert_public
  on public.event_registrations
  for insert
  to anon, authenticated
  with check (
    event_id in (
      'rubiks-cube-competition',
      'sudoku-game-easy-level',
      'codm-tournament',
      'mobile-legends-tournament',
      'fast-typing',
      'crimping-competition',
      'assembling-and-disassembling-competition',
      'battle-of-the-bands',
      'basketball-half-court'
    )
  );

create or replace function public.registration_event_title(p_event_id text)
returns text
language sql
immutable
as $$
  select case p_event_id
    when 'rubiks-cube-competition' then 'Rubik''s Cube Competition'
    when 'sudoku-game-easy-level' then 'Sudoku Game (Easy Level)'
    when 'codm-tournament' then 'Call of Duty: Mobile (CODM) Tournament'
    when 'mobile-legends-tournament' then 'Mobile Legends Tournament'
    when 'fast-typing' then 'Fast Typing Competition'
    when 'crimping-competition' then 'Crimping Competition'
    when 'assembling-and-disassembling-competition' then 'Assembling and Disassembling Competition'
    when 'battle-of-the-bands' then 'Battle of the Bands'
    when 'basketball-half-court' then 'Basketball (Men''s Half Court)'
    else p_event_id
  end;
$$;

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
  individual_family_limit integer := 2;
  individual_max_participants integer := 8;
  team_family_limit integer := 2;
  team_max_teams integer := 8;
begin
  if normalized_event not in (
    'rubiks-cube-competition',
    'sudoku-game-easy-level',
    'codm-tournament',
    'mobile-legends-tournament',
    'fast-typing',
    'crimping-competition',
    'assembling-and-disassembling-competition',
    'battle-of-the-bands',
    'basketball-half-court'
  ) then
    return jsonb_build_object(
      'status', 400,
      'error', 'invalid_event',
      'message', 'Unsupported registration event.'
    );
  end if;

  if normalized_event = 'assembling-and-disassembling-competition' then
    individual_family_limit := 1;
    individual_max_participants := 4;
  elsif normalized_event = 'fast-typing' then
    individual_family_limit := 2;
    individual_max_participants := 8;
  end if;

  if normalized_event = 'battle-of-the-bands' then
    team_family_limit := 1;
    team_max_teams := 4;
  elsif normalized_event = 'basketball-half-court' then
    team_family_limit := 1;
    team_max_teams := 8;
  elsif normalized_event in ('codm-tournament', 'mobile-legends-tournament') then
    team_family_limit := 2;
    team_max_teams := 8;
  end if;

  event_title_value := public.registration_event_title(normalized_event);

  select count(*)::int, coalesce(max(submitted_at), timezone('utc', now()))
  into total_count, updated_at
  from public.event_registrations
  where event_id = normalized_event;

  with families(family, ordinal) as (
    values
      ('Family 1 - Claude'::text, 1),
      ('Family 2 - Grace'::text, 2),
      ('Family 3 - Justin'::text, 3),
      ('Family 4 - Kimberly'::text, 4)
  ),
  registrations_by_family as (
    select f.family, f.ordinal, count(*)::int as count
    from families f
    left join public.event_registrations er on (
      er.event_id = normalized_event
      and er.family = f.family
      and er.registration_cancelled_at is null
    )
    group by f.family, f.ordinal
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'family', rbf.family,
      'count', rbf.count,
      'limit', case when normalized_event in ('codm-tournament', 'mobile-legends-tournament') then team_family_limit else individual_family_limit end,
      'remaining', case when normalized_event in ('codm-tournament', 'mobile-legends-tournament', 'battle-of-the-bands', 'basketball-half-court') then team_family_limit - rbf.count else individual_family_limit - rbf.count end
    )
    order by rbf.ordinal
  ), '[]'::jsonb)
  into per_family
  from registrations_by_family rbf;

  with owned_registrations as (
    select id, family, name, captain, team_label, 
      row_number() over (partition by family order by submitted_at desc) as position
    from public.event_registrations
    where event_id = normalized_event
      and registration_cancelled_at is null
      and (registration_owner_token_hash is null or registration_owner_token_hash = owner_token_hash_value)
    order by submitted_at desc
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', or_regs.id,
      'family', or_regs.family,
      'name', or_regs.name,
      'captain', or_regs.captain,
      'teamLabel', or_regs.team_label,
      'canCancel', owner_token_hash_value is not null and or_regs.position = 1
    )
  ), '[]'::jsonb)
  into registrations
  from owned_registrations or_regs;

  with team_registrations as (
    select
      captain, team_label, family,
      row_number() over (partition by family order by submitted_at desc) as position,
      array_length(members, 1) + 1 as total_members
    from public.event_registrations
    where event_id = normalized_event
      and registration_cancelled_at is null
      and registration_type = 'team'
    order by submitted_at desc
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'captain', tr.captain,
      'teamLabel', tr.team_label,
      'family', tr.family,
      'totalMembers', tr.total_members
    )
  ), '[]'::jsonb)
  into teams
  from team_registrations tr;

  if normalized_event = 'sudoku-game-easy-level' then
    with family_counts as (
      select family, count(*)::int from registrations_by_family group by family
    )
    select bool_and(count = 2) into all_families_complete from family_counts;
  end if;

  if normalized_event in ('codm-tournament', 'mobile-legends-tournament', 'battle-of-the-bands', 'basketball-half-court') then
    stats := jsonb_build_object(
      'mode', 'team',
      'totalTeams', total_count,
      'maxTeams', team_max_teams,
      'remainingTeams', greatest(0, team_max_teams - total_count),
      'isClosed', total_count >= team_max_teams,
      'perFamily', per_family,
      'teams', teams
    );
  else
    stats := jsonb_build_object(
      'mode', 'individual',
      'totalParticipants', total_count,
      'maxParticipants', individual_max_participants,
      'remainingParticipants', greatest(0, individual_max_participants - total_count),
      'isClosed', total_count >= individual_max_participants,
      'perFamily', per_family,
      'allFamiliesComplete', all_families_complete
    );
  end if;

  return jsonb_build_object(
    'status', 200,
    'state', jsonb_build_object(
      'eventId', normalized_event,
      'eventTitle', event_title_value,
      'registrations', registrations,
      'stats', stats,
      'updatedAt', updated_at::text
    )
  );
end;
$$;

