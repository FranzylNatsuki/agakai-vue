-- Senior identity: Supabase Auth owns the PIN; profiles are owned per auth user.
-- Sign-in is Senior ID + 6-digit PIN. The client never reads a credential column.

-- 1. Ownership link used by RLS.
alter table public."user"
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete cascade;

-- 2. Remove client-readable secrets and the unused email field.
alter table public."user" drop column if exists password;
alter table public."user" drop column if exists email;

-- 2b. Senior IDs are stored lowercase so sign-in lookup matches exactly.
update public."user"
  set senior_id = lower(btrim(senior_id))
  where senior_id is not null and senior_id <> lower(btrim(senior_id));
drop index if exists public.user_senior_id_key;

-- 3. Create the profile when an auth user is provisioned (admin dashboard or API).
--    Senior ID metadata is only read at creation; ownership always comes from auth.uid().
create or replace function public.handle_new_senior()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'senior_id', '')));
begin
  if sid = '' then
    return new;
  end if;
  insert into public."user" (auth_user_id, senior_id, name, birthday, gender, address, mobile_no)
  values (
    new.id,
    sid,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Senior Citizen'),
    nullif(btrim(new.raw_user_meta_data ->> 'birthday'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'gender'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'address'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'mobile_no'), '')
  )
  on conflict (senior_id) do update
    set auth_user_id = excluded.auth_user_id
    where public."user".auth_user_id is null;
  return new;
end;
$$;

-- 4. Drop the unused duplicate profile table (empty; replaced by public."user").
drop table if exists public.seniors;

-- 5. Lock down the profile table.
alter table public."user" enable row level security;

drop policy if exists "Allow anon read user" on public."user";
drop policy if exists "user_select_public" on public."user";
drop policy if exists "Allow anon update user notes" on public."user";
drop policy if exists "profiles_select_own" on public."user";
drop policy if exists "profiles_update_own" on public."user";

create policy profiles_select_own on public."user"
  for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy profiles_update_own on public."user"
  for update to authenticated
  using ((select auth.uid()) = auth_user_id)
  with check ((select auth.uid()) = auth_user_id);

-- RLS is row-level; column grants restrict writes to the memory note only.
revoke all on table public."user" from anon, authenticated;
grant select on table public."user" to authenticated;
grant update (user_notes) on table public."user" to authenticated;

-- 6. One policy for the public benefit catalogue.
alter table public.benefit enable row level security;
drop policy if exists "Allow anon read benefit" on public.benefit;
drop policy if exists "benefit_select_public" on public.benefit;
drop policy if exists "benefit_read_all" on public.benefit;
create policy benefit_read_all on public.benefit
  for select to anon, authenticated
  using (true);
grant select on table public.benefit to anon, authenticated;
grant select on table public.lgu to anon, authenticated;

-- 7. Trigger functions must not be callable from the Data API.
revoke all on function public.handle_new_senior() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_senior() to supabase_auth_admin;
  end if;
end;
$$;
