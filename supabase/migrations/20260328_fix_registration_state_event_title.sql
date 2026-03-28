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