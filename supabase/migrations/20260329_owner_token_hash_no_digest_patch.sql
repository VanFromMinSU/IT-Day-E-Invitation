-- Patch already-deployed databases to stop relying on pgcrypto digest() for owner token checks.

update public.event_registrations
set owner_token_hash = lower(
  md5(id::text || coalesce(submitted_at::text, ''))
  ||
  md5(coalesce(submitted_at::text, '') || id::text)
)
where owner_token_hash is null
  or btrim(owner_token_hash) = ''
  or btrim(owner_token_hash) !~ '^[A-Fa-f0-9]{64}$';

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
