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

  delete from public.event_votes where true;

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

create or replace function public.reset_reactions_with_token(p_admin_token_hash text)
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
begin
  if provided_admin_token_hash = '' or provided_admin_token_hash <> configured_admin_token_hash then
    return jsonb_build_object(
      'status', 403,
      'error', 'forbidden',
      'message', 'Admin access required.'
    );
  end if;

  delete from public.event_votes where true;

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
