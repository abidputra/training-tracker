-- =============================================================================
-- 0002_usernames.sql  |  Usernames: sign in with email OR username
--
-- Tables
--   profiles  one row per user. username is stored lowercase and is unique.
--             Readable only by its owner; everything anonymous goes through the
--             two functions below.
--
-- Functions (callable by anon, so the login/signup screens can use them)
--   username_available(uname)  -> boolean  pre-check for signup / username change
--   email_for_username(uname)  -> text     lets the login form turn a username
--                                          into the email Supabase Auth needs
-- =============================================================================

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "owner can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "owner can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "owner can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- New accounts: copy the username from the signup metadata into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that already exist get a row with no username yet. They can set
-- one in Settings.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.username_available(uname text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = lower(uname)
  );
$$;

create or replace function public.email_for_username(uname text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(uname);
$$;

revoke execute on function public.username_available(text) from public;
revoke execute on function public.email_for_username(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.email_for_username(text) to anon, authenticated;
