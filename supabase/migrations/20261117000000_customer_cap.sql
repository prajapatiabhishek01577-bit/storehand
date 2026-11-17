-- Feral AI: at most 4 customer accounts (one per compose slot). Enforced in the
-- database so a direct call to the Supabase auth API can't skip it.
create or replace function public.feralai_customer_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize signups so two at once can't both pass the count.
  perform pg_advisory_xact_lock(hashtext('feralai_customer_cap'));
  if (select count(*) from auth.users) >= 4 then
    raise exception 'feralai: customer limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.feralai_customer_cap() from public, anon, authenticated;

drop trigger if exists feralai_customer_cap on auth.users;
create trigger feralai_customer_cap
  before insert on auth.users
  for each row execute function public.feralai_customer_cap();
