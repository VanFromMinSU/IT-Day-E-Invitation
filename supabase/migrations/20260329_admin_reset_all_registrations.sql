create or replace function public.reset_all_registrations()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  admin_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  mutation_time timestamptz := timezone('utc', now());
  affected_event_ids text[];
begin
  if admin_role <> 'admin' then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('registration:reset_all'));

  with deleted as (
    delete from public.event_registrations
    returning event_id
  )
  select coalesce(array_agg(distinct event_id), '{}'::text[])
  into affected_event_ids
  from deleted;

  return jsonb_build_object(
    'status', 200,
    'message', 'All registrations have been reset successfully.',
    'eventIds', to_jsonb(affected_event_ids),
    'updatedAt', mutation_time,
    'reason', 'registration_reset'
  );
end;
$$;

create or replace function public.reset_all_registrations_with_token(p_admin_token_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  configured_admin_token_hash text := lower(
    coalesce(
      nullif(current_setting('app.response_admin_token_hash', true), ''),
      'fb7cd66cd9802076b019b15ddf51cfbfd6ae603642a4153a5b78ae8696515bd4'
    )
  );
  provided_admin_token_hash text := lower(btrim(coalesce(p_admin_token_hash, '')));
  mutation_time timestamptz := timezone('utc', now());
  affected_event_ids text[];
begin
  if provided_admin_token_hash = '' or provided_admin_token_hash <> configured_admin_token_hash then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  perform pg_advisory_xact_lock(hashtext('registration:reset_all'));

  with deleted as (
    delete from public.event_registrations
    returning event_id
  )
  select coalesce(array_agg(distinct event_id), '{}'::text[])
  into affected_event_ids
  from deleted;

  return jsonb_build_object(
    'status', 200,
    'message', 'All registrations have been reset successfully.',
    'eventIds', to_jsonb(affected_event_ids),
    'updatedAt', mutation_time,
    'reason', 'registration_reset'
  );
end;
$$;

revoke all on function public.reset_all_registrations() from public;
revoke all on function public.reset_all_registrations_with_token(text) from public;

grant execute on function public.reset_all_registrations() to authenticated;
grant execute on function public.reset_all_registrations_with_token(text) to anon, authenticated;
